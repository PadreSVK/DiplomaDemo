$buildConfig = cat $("$PSScriptRoot/buildConfig.json") | Out-String | ConvertFrom-Json
function buildWithMono([string]$csprojDir,[String]$emsdkRoot){
    if(-not $IsLinux){
       Write-Host "OS for build must be linux" -ForegroundColor Red
       Write-Host "Setup default wsl distro to Ubuntu" -ForegroundColor Green
       wslconfig /setdefault Ubuntu
       Write-Host "Run bash on default WSL distro ""bash -c ""source build.sh\"""" => distro must have installed pwsh" -ForegroundColor Yellow
       pushd $csprojDir
       bash -c "./build.sh"
       popd
       return
    }
    Write-Host "Loading EMSDK env variables - is required for AOT build"
    Write-Host $emsdkRoot
    & $("$emsdkRoot/emsdk_env.ps1")
    pushd $csprojDir
    if((Test-Path -Path "$csprojDir\obj" )){
        Remove-Item "$csprojDir\obj" -Force -Recurse
    } 
    $start = $([System.DateTime]::UtcNow)
    Write-Host "build start $start"
    msbuild DiplomaDemo.WasmAOT.csproj /r /p:Configuration=Release
    Write-Host "build start $start"
    $seconds = $( $([System.DateTime]::UtcNow)-$start).Seconds
    Write-Host "build took $seconds s"
    Remove-Item "$csprojDir\obj" -Force -Recurse
    popd
}

buildWithMono -csprojDir $PSScriptRoot -emsdkRoot $buildConfig.emsdkPath
