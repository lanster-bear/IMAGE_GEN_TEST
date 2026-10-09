import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from '../server/config.mjs';
import { buildService } from './build-service.mjs';

const sdkVersion = '1.0.4258.31';
const sdkSha256 = '56f7f4b8bf9aee4b8efefbbdd4f67d5f74ebd1b100ed0806da71bf76af481aa9';
const buildDir = path.join(ROOT, '.data/build/webview2');
const sdkDir = path.join(buildDir, `sdk-${sdkVersion}`);
const compiler = path.join(process.env.WINDIR || 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');

function powershell(code, variables = {}) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$ErrorActionPreference = 'Stop'; ${code}`], { env: { ...process.env, ...variables }, encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Windows 构建工具失败。');
  return result.stdout;
}

await mkdir(sdkDir, { recursive: true });
const sdkPackage = path.join(buildDir, `webview2-${sdkVersion}.zip`);
const sdkHashFile = `${sdkPackage}.sha256`;
let sdkBytes;
try {
  sdkBytes = await readFile(sdkPackage);
  const expected = (await readFile(sdkHashFile, 'utf8')).trim();
  if (createHash('sha256').update(sdkBytes).digest('hex') !== expected) throw new Error('WebView2 SDK 缓存校验失败。');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const url = `https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/${sdkVersion}/microsoft.web.webview2.${sdkVersion}.nupkg`;
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`官方下载 WebView2 SDK 失败：${response.status}`);
  sdkBytes = Buffer.from(await response.arrayBuffer());
  await writeFile(sdkPackage, sdkBytes);
  await writeFile(sdkHashFile, createHash('sha256').update(sdkBytes).digest('hex'));
}
if (createHash('sha256').update(sdkBytes).digest('hex') !== sdkSha256) throw new Error('WebView2 SDK 与已核验的官方版本哈希不一致。');
powershell('Expand-Archive -LiteralPath $env:STUDIO_SDK_PACKAGE -DestinationPath $env:STUDIO_SDK_DIR -Force', { STUDIO_SDK_PACKAGE: sdkPackage, STUDIO_SDK_DIR: sdkDir });
const coreDll = path.join(sdkDir, 'lib/net462/Microsoft.Web.WebView2.Core.dll');
const formsDll = path.join(sdkDir, 'lib/net462/Microsoft.Web.WebView2.WinForms.dll');
const loaderDll = path.join(sdkDir, 'runtimes/win-x64/native/WebView2Loader.dll');
powershell("foreach ($file in @($env:STUDIO_CORE_DLL, $env:STUDIO_FORMS_DLL, $env:STUDIO_LOADER_DLL)) { $signature = Get-AuthenticodeSignature -LiteralPath $file; if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft Corporation') { throw ('Microsoft SDK signature check failed: ' + [IO.Path]::GetFileName($file)) } }", { STUDIO_CORE_DLL: coreDll, STUDIO_FORMS_DLL: formsDll, STUDIO_LOADER_DLL: loaderDll });

const service = await buildService(path.join(buildDir, 'service'));
const payloadDir = path.join(buildDir, 'payload');
await mkdir(payloadDir, { recursive: true });
for (const filename of [service.exe, coreDll, formsDll, loaderDll]) await copyFile(filename, path.join(payloadDir, path.basename(filename)));
const hash = createHash('sha256').update(service.buildId).update(sdkVersion);
for (const file of ['desktop/Host.cs', 'desktop/app.manifest']) hash.update(await readFile(path.join(ROOT, file)));
const buildId = hash.digest('hex').slice(0, 16);
const buildIdFile = path.join(buildDir, 'host-build-id.txt');
await writeFile(buildIdFile, buildId);
const payloadFile = path.join(buildDir, 'payload.zip');
powershell("Add-Type -AssemblyName System.IO.Compression.FileSystem; if (Test-Path -LiteralPath $env:STUDIO_PAYLOAD_ZIP) { Remove-Item -LiteralPath $env:STUDIO_PAYLOAD_ZIP }; [IO.Compression.ZipFile]::CreateFromDirectory($env:STUDIO_PAYLOAD_DIR, $env:STUDIO_PAYLOAD_ZIP, [IO.Compression.CompressionLevel]::Optimal, $false)", { STUDIO_PAYLOAD_DIR: payloadDir, STUDIO_PAYLOAD_ZIP: payloadFile });

const exe = path.join(ROOT, 'Image Studio.exe');
const compiledExe = path.join(buildDir, 'Image Studio.exe');
const argumentsList = ['/nologo', '/target:winexe', '/platform:x64', '/optimize+', `/out:${compiledExe}`, `/win32manifest:${path.join(ROOT, 'desktop/app.manifest')}`, '/reference:System.dll', '/reference:System.Core.dll', '/reference:System.Drawing.dll', '/reference:System.Windows.Forms.dll', '/reference:System.Net.Http.dll', '/reference:System.Web.Extensions.dll', '/reference:System.IO.Compression.dll', '/reference:System.IO.Compression.FileSystem.dll', `/reference:${coreDll}`, `/reference:${formsDll}`, `/resource:${payloadFile},StudioPayload`, `/resource:${buildIdFile},StudioBuildId`, path.join(ROOT, 'desktop/Host.cs')];
const compile = spawnSync(compiler, argumentsList, { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
if (compile.status !== 0) throw new Error(compile.stderr || compile.stdout || 'WebView2 桌面编译失败。');
await copyFile(compiledExe, exe);
const exeBytes = await readFile(exe);
const { parseCredentials } = await import('../server/config.mjs');
let credentials;
try { credentials = parseCredentials(await readFile(path.join(ROOT, 'Image_key.txt'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const file of [exe, service.exe, coreDll, formsDll, loaderDll]) {
  const bytes = file === exe ? exeBytes : await readFile(file);
  if (credentials?.apiKey && bytes.includes(Buffer.from(credentials.apiKey))) throw new Error('构建资源中发现真实密钥。');
}
const result = { exe, bytes: (await stat(exe)).size, sha256: createHash('sha256').update(exeBytes).digest('hex'), buildId, sdkVersion, sdkSha256: createHash('sha256').update(sdkBytes).digest('hex') };
await writeFile(path.join(buildDir, 'build-result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
