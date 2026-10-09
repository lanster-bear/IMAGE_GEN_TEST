using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal static class Program
{
    internal static string Root;
    internal static string Runtime;
    internal static bool Smoke;
    internal static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    private static Mutex instance;

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern bool SetDllDirectory(string path);
    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr window);

    [STAThread]
    private static void Main(string[] arguments)
    {
        Root = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
        Smoke = Array.IndexOf(arguments, "--smoke-test") >= 0;
        if (Smoke) Root = Path.Combine(Root, ".data", "desktop-qa");
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        try
        {
            Directory.CreateDirectory(Path.Combine(Root, ".data"));
            bool created;
            instance = new Mutex(true, "Local\\ImageStudio-" + Hash(Root.ToUpperInvariant()).Substring(0, 24), out created);
            if (!created)
            {
                FocusExisting();
                instance.Dispose();
                instance = null;
                return;
            }
            ExtractRuntime();
            AppDomain.CurrentDomain.AssemblyResolve += ResolveAssembly;
            SetDllDirectory(Runtime);
            RunWindow();
        }
        catch (Exception error)
        {
            Log("startup", error);
            if (!Smoke) MessageBox.Show("工作台无法启动。请检查目录写入权限和微软 WebView2 Runtime。\n\n详情已写入 .data/desktop.log。", "Image Studio", MessageBoxButtons.OK, MessageBoxIcon.Error);
            Environment.ExitCode = 1;
        }
        finally
        {
            if (instance != null) { try { instance.ReleaseMutex(); } catch (ApplicationException) {} instance.Dispose(); }
        }
    }

    [System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.NoInlining)]
    private static void RunWindow() { Application.Run(new StudioWindow()); }

    private static Assembly ResolveAssembly(object sender, ResolveEventArgs arguments)
    {
        string name = new AssemblyName(arguments.Name).Name;
        if (name != "Microsoft.Web.WebView2.Core" && name != "Microsoft.Web.WebView2.WinForms") return null;
        return Assembly.LoadFrom(Path.Combine(Runtime, name + ".dll"));
    }

    private static void ExtractRuntime()
    {
        string buildId;
        using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("StudioBuildId"))
        using (StreamReader reader = new StreamReader(stream)) buildId = reader.ReadToEnd().Trim();
        Runtime = Path.Combine(Root, ".data", "runtime", "webview2-" + buildId);
        Directory.CreateDirectory(Runtime);
        string marker = Path.Combine(Runtime, ".ready");
        if (File.Exists(marker)) return;
        using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("StudioPayload"))
        using (ZipArchive archive = new ZipArchive(stream, ZipArchiveMode.Read))
        {
            foreach (ZipArchiveEntry entry in archive.Entries)
            {
                string destination = Path.GetFullPath(Path.Combine(Runtime, entry.FullName));
                if (!destination.StartsWith(Runtime + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Invalid runtime asset.");
                Directory.CreateDirectory(Path.GetDirectoryName(destination));
                using (Stream input = entry.Open())
                using (FileStream output = File.Create(destination)) input.CopyTo(output);
            }
        }
        File.WriteAllText(marker, buildId, new UTF8Encoding(false));
    }

    internal static string Hash(string value)
    {
        using (SHA256 digest = SHA256.Create()) return BitConverter.ToString(digest.ComputeHash(Encoding.UTF8.GetBytes(value))).Replace("-", "").ToLowerInvariant();
    }

    private static void FocusExisting()
    {
        try
        {
            int pid = Int32.Parse(File.ReadAllText(Path.Combine(Root, ".data", "desktop.pid")));
            using (Process process = Process.GetProcessById(pid))
            {
                if (!String.Equals(process.MainModule.FileName, Assembly.GetExecutingAssembly().Location, StringComparison.OrdinalIgnoreCase)) return;
                ShowWindow(process.MainWindowHandle, 9);
                SetForegroundWindow(process.MainWindowHandle);
            }
        }
        catch (Exception) {}
    }

    internal static void Log(string stage, Exception error)
    {
        try { File.AppendAllText(Path.Combine(Root, ".data", "desktop.log"), DateTime.UtcNow.ToString("o") + " " + stage + " " + error.GetType().Name + "\n", new UTF8Encoding(false)); }
        catch (Exception) {}
    }
}

internal sealed class StudioWindow : Form
{
    private readonly WebView2 webview = new WebView2();
    private readonly Label loading = new Label();
    private readonly HttpClient client;
    private Process service;
    private string serviceInfo;
    private string origin;
    private string token;
    private bool closing;
    private bool checkingClose;
    private bool loaded;

    internal StudioWindow()
    {
        Text = "Image Studio";
        float scale;
        using (Graphics desktop = Graphics.FromHwnd(IntPtr.Zero)) scale = desktop.DpiX / 96f;
        Rectangle available = Screen.PrimaryScreen.WorkingArea;
        ClientSize = new Size(Math.Min((int)(1280 * scale), (int)(available.Width * 0.92)), Math.Min((int)(840 * scale), (int)(available.Height * 0.88)));
        MinimumSize = new Size(Math.Min((int)(820 * scale), available.Width), Math.Min((int)(600 * scale), available.Height));
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(231, 233, 238);
        AutoScaleMode = AutoScaleMode.Dpi;
        client = new HttpClient(new HttpClientHandler { UseProxy = false });
        client.Timeout = TimeSpan.FromSeconds(5);
        webview.Dock = DockStyle.Fill;
        webview.DefaultBackgroundColor = BackColor;
        loading.Text = "正在启动工作台…";
        loading.TextAlign = ContentAlignment.MiddleCenter;
        loading.Dock = DockStyle.Fill;
        loading.Font = new Font("Microsoft YaHei UI", 12);
        Controls.Add(webview);
        Controls.Add(loading);
        Shown += async (sender, arguments) => await StartAsync();
        FormClosing += async (sender, arguments) => await HandleClosingAsync(arguments);
        FormClosed += (sender, arguments) => { webview.Dispose(); client.Dispose(); if (service != null) service.Dispose(); };
        File.WriteAllText(Path.Combine(Program.Root, ".data", "desktop.pid"), Process.GetCurrentProcess().Id.ToString());
    }

    private async Task StartAsync()
    {
        try
        {
            if (!Program.Smoke) await CheckLegacyServiceAsync();
            CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Program.Root, ".data", "webview-profile"));
            await webview.EnsureCoreWebView2Async(environment);
            await RestorePreferencesAsync();
            webview.CoreWebView2.Settings.AreDevToolsEnabled = false;
            webview.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            webview.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webview.CoreWebView2.Settings.IsZoomControlEnabled = false;
            webview.CoreWebView2.Settings.IsWebMessageEnabled = false;
            webview.CoreWebView2.NewWindowRequested += (sender, arguments) => { arguments.Handled = true; };
            webview.CoreWebView2.PermissionRequested += (sender, arguments) => { arguments.State = CoreWebView2PermissionState.Deny; };
            webview.CoreWebView2.NavigationStarting += (sender, arguments) =>
            {
                Uri destination;
                if (!Uri.TryCreate(arguments.Uri, UriKind.Absolute, out destination) || destination.GetLeftPart(UriPartial.Authority) != origin) arguments.Cancel = true;
            };
            webview.CoreWebView2.DownloadStarting += (sender, arguments) =>
            {
                Uri download;
                if (!Uri.TryCreate(arguments.DownloadOperation.Uri, UriKind.Absolute, out download) || download.GetLeftPart(UriPartial.Authority) != origin) arguments.Cancel = true;
            };
            StartService();
            await WaitForServiceAsync();
            webview.CoreWebView2.NavigationCompleted += async (sender, arguments) =>
            {
                if (!arguments.IsSuccess) { loading.Text = "页面加载失败。请关闭后重新打开。"; return; }
                loaded = true;
                loading.Hide();
                if (Program.Smoke) await VerifyWindowAsync();
            };
            webview.CoreWebView2.Navigate(origin);
        }
        catch (Exception error)
        {
            Program.Log("window", error);
            loading.Text = error is WebView2RuntimeNotFoundException ? "缺少 Microsoft Edge WebView2 Runtime。\n请安装微软运行环境后重新打开。" : error.Message;
            if (Program.Smoke) { Environment.ExitCode = 1; Close(); }
        }
    }

    private async Task CheckLegacyServiceAsync()
    {
        try
        {
            string text = await client.GetStringAsync("http://127.0.0.1:4317/api/health");
            Dictionary<string, object> health = Program.Json.Deserialize<Dictionary<string, object>>(text);
            if (!health.ContainsKey("app") || (string)health["app"] != "image-gen-studio") return;
            if (health.ContainsKey("outputDirectory") && !String.Equals((string)health["outputDirectory"], Path.Combine(Program.Root, "outputs"), StringComparison.OrdinalIgnoreCase)) return;
            throw new InvalidOperationException("原浏览器版服务还在运行。请先用 Stop Studio.cmd 停止它，再打开桌面版。\n历史和图片不会被删除。");
        }
        catch (HttpRequestException) {}
        catch (TaskCanceledException) {}
    }

    private void StartService()
    {
        int port;
        TcpListener listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        serviceInfo = Path.Combine(Program.Root, ".data", "desktop-session-" + Guid.NewGuid().ToString("N") + ".json");
        ProcessStartInfo start = new ProcessStartInfo(Path.Combine(Program.Runtime, "StudioService.exe"));
        start.WorkingDirectory = Program.Root;
        start.UseShellExecute = false;
        start.CreateNoWindow = true;
        start.WindowStyle = ProcessWindowStyle.Hidden;
        start.EnvironmentVariables["STUDIO_ROOT"] = Program.Root;
        start.EnvironmentVariables["STUDIO_OPEN"] = "0";
        start.EnvironmentVariables["STUDIO_DESKTOP"] = "1";
        start.EnvironmentVariables["STUDIO_DESKTOP_INFO"] = serviceInfo;
        start.EnvironmentVariables["PORT"] = port.ToString();
        if (Program.Smoke)
        {
            start.EnvironmentVariables["IMAGE2_BASE_URL"] = Environment.GetEnvironmentVariable("STUDIO_QA_PROVIDER_URL") ?? "http://127.0.0.1:9";
            start.EnvironmentVariables["IMAGE2_API_KEY"] = "desktop-fixture-key";
            start.EnvironmentVariables["IMAGE2_TIMEOUT"] = "10";
        }
        service = Process.Start(start);
    }

    private async Task WaitForServiceAsync()
    {
        for (int attempt = 0; attempt < 150; attempt++)
        {
            if (service.HasExited) throw new InvalidOperationException("内置服务未启动。请检查 .data/portable.log。不会自动重试生成请求。");
            if (File.Exists(serviceInfo))
            {
                try
                {
                    Dictionary<string, object> info = Program.Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(serviceInfo));
                    if (Convert.ToInt32(info["pid"]) != service.Id) throw new InvalidDataException("Service identity mismatch.");
                    origin = "http://127.0.0.1:" + info["port"];
                    token = (string)info["token"];
                    return;
                }
                catch (ArgumentException) {}
            }
            await Task.Delay(200);
        }
        throw new TimeoutException("内置服务启动超时，请检查 .data/portable.log。");
    }

    private async Task HandleClosingAsync(FormClosingEventArgs arguments)
    {
        if (closing) return;
        arguments.Cancel = true;
        if (checkingClose) return;
        checkingClose = true;
        try
        {
            if (service != null && !service.HasExited)
            {
                if (token == null) { loading.Text = "内置服务仍在启动，请稍后关闭。"; return; }
                using (HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Post, origin + "/api/desktop/stop"))
                {
                    request.Headers.Add("X-Studio-Token", token);
                    request.Content = new StringContent("{}", Encoding.UTF8, "application/json");
                    using (HttpResponseMessage response = await client.SendAsync(request))
                    {
                        if (response.StatusCode == HttpStatusCode.Conflict)
                        {
                            if (!Program.Smoke) MessageBox.Show(this, "生成任务仍在处理中。请等待完成后退出，避免中断和重复计费。", "暂时不能退出", MessageBoxButtons.OK, MessageBoxIcon.Information);
                            return;
                        }
                        response.EnsureSuccessStatusCode();
                    }
                }
                for (int attempt = 0; attempt < 100 && !service.HasExited; attempt++) await Task.Delay(100);
                if (!service.HasExited) throw new TimeoutException("内置服务仍在退出，请稍后再关闭。");
            }
            await SavePreferencesAsync();
            closing = true;
            if (File.Exists(serviceInfo)) File.Delete(serviceInfo);
            File.Delete(Path.Combine(Program.Root, ".data", "desktop.pid"));
            Close();
        }
        catch (Exception error)
        {
            Program.Log("close", error);
            if (!Program.Smoke) MessageBox.Show(this, "暂时无法确认任务状态。窗口会保留，请稍后再关闭。", "Image Studio", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
        finally { checkingClose = false; }
    }

    private async Task RestorePreferencesAsync()
    {
        string filename = Path.Combine(Program.Root, ".data", "desktop-preferences.json");
        if (!File.Exists(filename)) return;
        try
        {
            Dictionary<string, string> saved = Program.Json.Deserialize<Dictionary<string, string>>(File.ReadAllText(filename));
            if (saved == null) return;
            Dictionary<string, string> allowed = new Dictionary<string, string>();
            foreach (string name in new[] { "studio-theme", "studio-draft", "studio-pending" }) if (saved.ContainsKey(name) && saved[name] != null) allowed[name] = saved[name];
            await webview.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync("for (const [key,value] of Object.entries(" + Program.Json.Serialize(allowed) + ")) localStorage.setItem(key,value);");
        }
        catch (ArgumentException) {}
    }

    private async Task SavePreferencesAsync()
    {
        if (!loaded) return;
        string result = await webview.CoreWebView2.ExecuteScriptAsync("JSON.stringify(Object.fromEntries(['studio-theme','studio-draft','studio-pending'].map(key=>[key,localStorage.getItem(key)])))");
        string preferences = Program.Json.Deserialize<string>(result);
        File.WriteAllText(Path.Combine(Program.Root, ".data", "desktop-preferences.json"), preferences, new UTF8Encoding(false));
    }

    private async Task VerifyWindowAsync()
    {
        if (!loaded) return;
        try
        {
            bool generated = false;
            bool protectedClose = false;
            bool restoredDraft = false;
            if (Environment.GetEnvironmentVariable("STUDIO_QA_PROVIDER_URL") != null)
            {
                for (int attempt = 0; attempt < 100; attempt++)
                {
                    if (await webview.CoreWebView2.ExecuteScriptAsync("document.getElementById('model').value !== ''") == "true") break;
                    await Task.Delay(100);
                }
                restoredDraft = await webview.CoreWebView2.ExecuteScriptAsync("document.getElementById('prompt').value.startsWith('Offline native WebView2 check')") == "true";
                string prompt = "Offline native WebView2 check " + Environment.GetEnvironmentVariable("STUDIO_QA_RUN_ID");
                await webview.CoreWebView2.ExecuteScriptAsync("document.getElementById('prompt').value=" + Program.Json.Serialize(prompt) + ";document.getElementById('prompt').dispatchEvent(new Event('input'));document.getElementById('generate-button').click();");
                for (int attempt = 0; attempt < 50; attempt++)
                {
                    Dictionary<string, object> health = Program.Json.Deserialize<Dictionary<string, object>>(await client.GetStringAsync(origin + "/api/health"));
                    if (Convert.ToInt32(health["pending"]) > 0)
                    {
                        FormClosingEventArgs probe = new FormClosingEventArgs(CloseReason.UserClosing, false);
                        await HandleClosingAsync(probe);
                        protectedClose = probe.Cancel && !closing && !service.HasExited;
                        break;
                    }
                    await Task.Delay(100);
                }
                for (int attempt = 0; attempt < 100; attempt++)
                {
                    string checkImage = "!!document.querySelector('#preview img') && document.querySelector('#preview img').alt === " + Program.Json.Serialize(prompt) + " && !document.getElementById('generate-button').disabled";
                    if (await webview.CoreWebView2.ExecuteScriptAsync(checkImage) == "true") { generated = true; break; }
                    await Task.Delay(100);
                }
                if (!generated || !protectedClose) throw new InvalidOperationException("Offline desktop workflow validation failed.");
            }
            string script = "JSON.stringify({title:document.title,hasPrompt:!!document.getElementById('prompt'),standalone:true,hasKey:document.documentElement.outerHTML.includes('desktop-fixture-key'),cssWidth:innerWidth,sideBySide:document.querySelector('.stage').getBoundingClientRect().left>document.querySelector('.composer').getBoundingClientRect().right})";
            string result = await webview.CoreWebView2.ExecuteScriptAsync(script);
            string decoded = Program.Json.Deserialize<string>(result);
            Dictionary<string, object> check = Program.Json.Deserialize<Dictionary<string, object>>(decoded);
            if (!(bool)check["hasPrompt"] || (bool)check["hasKey"]) throw new InvalidOperationException("Desktop page validation failed.");
            string screenshot = Path.Combine(Program.Root, "webview2-window.png");
            using (FileStream output = File.Create(screenshot)) await webview.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, output);
            File.WriteAllText(Path.Combine(Program.Root, "verification.json"), Program.Json.Serialize(new { window = check, runtime = webview.CoreWebView2.Environment.BrowserVersionString, servicePid = service.Id, nativeWindow = Handle.ToInt64(), screenshot = screenshot, offlineGeneration = generated, busyCloseProtected = protectedClose, draftRestored = restoredDraft, runId = Environment.GetEnvironmentVariable("STUDIO_QA_RUN_ID") }), new UTF8Encoding(false));
            Close();
        }
        catch (Exception error) { Program.Log("verification", error); Environment.ExitCode = 1; Close(); }
    }
}
