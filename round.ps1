Add-Type -AssemblyName System.Drawing
$sourcePath = "C:\Users\EmQizi\.gemini\antigravity-ide\brain\168c5a48-6aff-4aff-85ec-d6c81a15fcd6\.user_uploaded\media_1787405298414.png"
$targetSplash = "c:\Users\EmQizi\Documents\emqiziutility\LaundryAppMobile\assets\splash-icon.png"
$targetIcon = "c:\Users\EmQizi\Documents\emqiziutility\LaundryAppMobile\assets\icon.png"

$source = [System.Drawing.Image]::FromFile($sourcePath)
$bmp = New-Object System.Drawing.Bitmap $source.Width, $source.Height
$graph = [System.Drawing.Graphics]::FromImage($bmp)
$graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$radius = 120
$rect = New-Object System.Drawing.Rectangle 0, 0, $source.Width, $source.Height

$path.AddArc($rect.X, $rect.Y, ($radius * 2), ($radius * 2), 180, 90)
$path.AddArc($rect.Right - ($radius * 2), $rect.Y, ($radius * 2), ($radius * 2), 270, 90)
$path.AddArc($rect.Right - ($radius * 2), $rect.Bottom - ($radius * 2), ($radius * 2), ($radius * 2), 0, 90)
$path.AddArc($rect.X, $rect.Bottom - ($radius * 2), ($radius * 2), ($radius * 2), 90, 90)
$path.CloseFigure()

$graph.SetClip($path)
$graph.DrawImage($source, 0, 0, $source.Width, $source.Height)

$bmp.Save($targetSplash, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Save($targetIcon, [System.Drawing.Imaging.ImageFormat]::Png)

$source.Dispose()
$bmp.Dispose()
$graph.Dispose()
$path.Dispose()
Write-Host "Success"
