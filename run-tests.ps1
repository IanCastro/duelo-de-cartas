$ErrorActionPreference = "Stop"

$game = Get-Content ".\game.js" -Raw
$tests = Get-Content ".\game.test.js" -Raw
$bootstrap = "const __gameModule = { exports: {} }; const module = __gameModule; const exports = module.exports;`n" + $game + "`nconst game = __gameModule.exports;`n"
$patchedTests = $tests -replace 'const game = require\(\"\.\/game\.js\"\);', ''
$script = $bootstrap + $patchedTests

$script | node -
exit $LASTEXITCODE
