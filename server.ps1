# FinFlow Local Web Server
$port = 5000
$prefix = "http://localhost:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "FinFlow server running at $prefix"
$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $relPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($relPath) -or $relPath -eq '/') {
            $relPath = 'index.html'
        }

        $fullPath = Join-Path $baseDir $relPath
        if (Test-Path $fullPath -PathType Leaf) {
            $contentBytes = [System.IO.File]::ReadAllBytes($fullPath)
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
            switch ($ext) {
                '.html' { $response.ContentType = 'text/html; charset=utf-8' }
                '.js'   { $response.ContentType = 'application/javascript; charset=utf-8' }
                '.css'  { $response.ContentType = 'text/css; charset=utf-8' }
                '.json' { $response.ContentType = 'application/json; charset=utf-8' }
                '.svg'  { $response.ContentType = 'image/svg+xml' }
                '.png'  { $response.ContentType = 'image/png' }
                default { $response.ContentType = 'application/octet-stream' }
            }
            $response.ContentLength64 = $contentBytes.Length
            $response.OutputStream.Write($contentBytes, 0, $contentBytes.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.OutputStream.Close()
    }
} finally {
    $listener.Stop()
}
