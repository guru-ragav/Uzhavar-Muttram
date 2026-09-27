$port = 8080
$prefix = "http://localhost:$port/"
$prefixIp = "http://127.0.0.1:$port/"
# Serve files from the folder this script lives in (works for any user/machine)
$root = $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Prefixes.Add($prefixIp)
try {
    $listener.Start()
} catch {
    Write-Host "Failed to start listener: $_"
    exit 1
}

Write-Host "Uzhavar Mutram Web Server active on http://localhost:$port/ and http://127.0.0.1:$port/"

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".ico"  = "image/x-icon"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/") { $urlPath = "/index.html" }
        
        $relativePath = $urlPath.TrimStart('/').Replace('/', '\')
        $filePath = Join-Path $root $relativePath
        
        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = $mimeTypes[$ext]
            if (-not $contentType) { $contentType = "application/octet-stream" }
            
            $response.ContentType = $contentType
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Service-Worker-Allowed", "/")
            
            try {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } catch {
                # Ignore client connection reset
            }
        } else {
            $response.StatusCode = 404
            $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        try { $response.OutputStream.Close() } catch {}
    }
} catch {
    Write-Host "Server loop ended: $_"
} finally {
    if ($listener.IsListening) { $listener.Stop() }
}
