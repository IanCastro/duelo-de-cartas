# Duelo de Cartas

Jogo de cartas local em HTML, CSS e JavaScript puro.

O projeto roda direto no navegador e a regra principal fica concentrada em [game.js](/Users/Ian/Documents/Code/Card%20Game/game.js). A interface esta em [index.html](/Users/Ian/Documents/Code/Card%20Game/index.html) e [styles.css](/Users/Ian/Documents/Code/Card%20Game/styles.css).

## Como abrir o jogo

Abra [index.html](/Users/Ian/Documents/Code/Card%20Game/index.html) no navegador.

Se preferir, voce tambem pode servir a pasta com qualquer servidor estatico local, mas isso nao e obrigatorio para o funcionamento basico.

## Como rodar os testes

Os testes ficam em [game.test.js](/Users/Ian/Documents/Code/Card%20Game/game.test.js) e sao executados com `Node.js`, sem `package.json` e sem runner externo.

No PowerShell, rode:

```powershell
$game = Get-Content .\game.js -Raw
$tests = Get-Content .\game.test.js -Raw
$bootstrap = "const __gameModule = { exports: {} }; const module = __gameModule; const exports = module.exports;`n" + $game + "`nconst game = __gameModule.exports;`n"
$patchedTests = $tests -replace 'const game = require\(\"\.\/game\.js\"\);', ''
$script = $bootstrap + $patchedTests
$script | node -
```

## Resultado esperado dos testes

Hoje a suite inclui testes de regressao que expoem bugs conhecidos. Entao, neste momento, o resultado esperado nao e totalmente verde.

Atualmente existem testes que falham de proposito para demonstrar:

- perda de carta ao encerrar o turno com um efeito armado
- rewind inconsistente em linha de efeito ja resolvido
- rewind inconsistente em linha de ataque letal

## Estrutura principal

- [index.html](/Users/Ian/Documents/Code/Card%20Game/index.html): estrutura da interface
- [styles.css](/Users/Ian/Documents/Code/Card%20Game/styles.css): estilos do tabuleiro, cartas e menus
- [game.js](/Users/Ian/Documents/Code/Card%20Game/game.js): regras do jogo, IA, log, rewind e renderizacao
- [game.test.js](/Users/Ian/Documents/Code/Card%20Game/game.test.js): suite de testes
- [TODO.md](/Users/Ian/Documents/Code/Card%20Game/TODO.md): backlog do projeto
