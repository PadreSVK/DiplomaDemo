
& "./DiplomaDemo.NetStandard/build.ps1"
& "./bootstraper/bootstraper.ps1"

cpi -Path "./bootstraper/tmp/out/*" -Destination "./DiplomaDemo.DotVVM/wwwroot/" -Recurse