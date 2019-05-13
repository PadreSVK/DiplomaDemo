$bootraperPath = $PSScriptRoot

$distConfig = cat .\bootstraperConfig.json | Out-String | ConvertFrom-Json

$bootraperPath = $PSScriptRoot
$tmp = "$bootraperPath\tmp"
$out = "$tmp\out"
$outbr = $($out+"br")
$outgz = $($out+"gz")

function log([string]$message){
    Write-Host $message -ForegroundColor Yellow
}

function init(){
    if(-not (test-path $out)){
        mkdir "$out\managed"
    }
    if(-not (test-path $outbr)){
        mkdir "$outbr\managed"
    }
    if(-not (test-path $outgz)){
        mkdir "$outgz\managed"
    }

    if(-not (test-path $distConfig.distPath)){
        Write-Host "distPath must be set"
    }
    if(-not (test-path $bootraperPath)){
        Write-Host "bootraperPath must be set"
    }
}

function stripUnoConfigProps($config){
    $config = $config | Select-Object -Property * -ExcludeProperty uno_remote_managedpath
    $config = $config | Select-Object -Property * -ExcludeProperty uno_dependencies
    $config = $config | Select-Object -Property * -ExcludeProperty uno_main
    $config = $config | Select-Object -Property * -ExcludeProperty enable_pwa
    $config = $config | Select-Object -Property * -ExcludeProperty offline_files
    $config = $config | Select-Object -Property * -ExcludeProperty environmentVariables
    return $config
}

function createConfigJson([string]$distPath,[string]$bootraperPath, [string]$tmpPath){
    $configs = ("mono-config.js","uno-config.js")
    $allConfigText = ""
    $configs | %{$allConfigText += $($(cat "$distPath\$_") + [Environment]::NewLine)}
    $allConfigText += "module.exports = config;"
    $Utf8NoBomEncoding = New-Object System.Text.UTF8Encoding $False
    [System.IO.File]::WriteAllLines("$tmpPath\config.js", $allConfigText , $Utf8NoBomEncoding)
    pushd $PSScriptRoot
    node "$bootraperPath\createConfigJson.js"
    popd
}

function createConfig([string]$distPath,[string]$bootraperPath, [string]$tmpPath){
    createConfigJson -distPath $distPath -bootraperPath $bootraperPath -tmpPath $tmp
    $config = cat "$tmp\config.json" | Out-String | ConvertFrom-Json 
    $jsonConfig = stripUnoConfigProps -config $config | ConvertTo-Json
    $jsConfig = "var config = " + $jsonConfig
    Set-Content -Path "$tmp\config.js" -Value $jsConfig 
}

function bootstrap([string]$out, [string]$distPath,[string]$compressed){
    
    if([string]::IsNullOrEmpty($compressed)){
        $compressed = $distPath
    }
    # copy required files
    ('mono.js', 'mono.wasm','require.js','mono.wasm') | %{cpi -Path "$compressed\$_" -Destination $out }

    $config = cat "$tmp\config.json" | Out-String | ConvertFrom-Json 
    log "copy items from  $compressed\$($config.uno_remote_managedpath)"
    Write-Host  "$compressed\$($config.uno_remote_managedpath)"
    ls "$compressed\$($config.uno_remote_managedpath)" | %{cpi -Path $_.FullName -Destination "$out\managed"}
    cpi -Path "$tmp\config.js" -Destination $out
    cpi -Path "$bootraperPath\bootstrap.js" -Destination $out
}

init

log "create and strip configs"
createConfig -distPath $distConfig.distPath -bootraperPath $bootraperPath -tmpPath $tmp

log "uncompressed"
bootstrap -out $out -distPath $distConfig.distPath
log "gzip compressed"
bootstrap -out $outbr -distPath $distConfig.distPath -compressed $distConfig.gzPath
bootstrap -out $outgz -distPath $distConfig.distPath -compressed $distConfig.brPath