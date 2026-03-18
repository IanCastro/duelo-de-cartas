# Duelo de Cartas

Jogo de cartas local em HTML, CSS e JavaScript puro.

O projeto roda direto no navegador e a regra principal fica concentrada em [game.js](./game.js). A interface esta em [index.html](./index.html) e [styles.css](./styles.css).

## Como abrir o jogo

Abra [index.html](./index.html) no navegador.

Se preferir, voce tambem pode servir a pasta com qualquer servidor estatico local, mas isso nao e obrigatorio para o funcionamento basico.

## Como rodar os testes

Os testes ficam em [game.test.js](./game.test.js) e sao executados com `Node.js`, sem `package.json` e sem runner externo.

O jeito mais simples de rodar tudo e usar:

```powershell
.\run-tests.bat
```

Esse script retorna codigo de erro diferente de zero quando a suite falha.

Se quiser rodar o comando bruto, use:

```powershell
$game = Get-Content .\game.js -Raw
$tests = Get-Content .\game.test.js -Raw
$bootstrap = "const __gameModule = { exports: {} }; const module = __gameModule; const exports = module.exports;`n" + $game + "`nconst game = __gameModule.exports;`n"
$patchedTests = $tests -replace 'const game = require\(\"\.\/game\.js\"\);', ''
$script = $bootstrap + $patchedTests
$script | node -
```

## Resultado esperado dos testes

A suite deve terminar verde ao rodar `.\run-tests.bat`.

Se algum teste falhar, o ideal e usar a mensagem do erro para localizar a regra quebrada em [game.js](./game.js) ou o cenario correspondente em [game.test.js](./game.test.js).

## Estrutura principal

- [index.html](./index.html): estrutura da interface
- [styles.css](./styles.css): estilos do tabuleiro, cartas e menus
- [game.js](./game.js): regras do jogo, IA, log, rewind e renderizacao
- [game.test.js](./game.test.js): suite de testes
- [TODO.md](./TODO.md): backlog do projeto
