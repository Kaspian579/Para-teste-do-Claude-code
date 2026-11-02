# Para-teste-do-Claude-code

## Cafeteria Torra Lenta (`cafeteria/`)

Site de uma cafeteria fictícia, feito primeiro para celular, em um único arquivo (`cafeteria/index.html`, HTML + CSS + JS puro, sem instalar nada).

- Elementos aparecem e somem suavemente ao rolar, nos dois sentidos.
- Cabeçalho some ao descer e volta ao subir; barra de progresso no topo.
- Navegação fixa embaixo no celular, com a seção atual destacada.
- Cardápio em abas, linha do processo que enche conforme a rolagem.
- Tema claro e escuro automáticos; respeita "reduzir movimento" do sistema.

Para ver: abra `cafeteria/index.html` no navegador.

O padrão de animação está documentado na skill `.claude/skills/scroll-reveal-mobile/`.

## Hamburgueria Brasa 41 (`hamburgueria/`)

Site de uma hamburgueria fictícia, feito primeiro para celular, em um único arquivo (`hamburgueria/index.html`, sem instalar nada). Projeto novo, construído só com as regras destes repositórios: taste-skill (direção visual), ui-ux-pro-max-skill (acessibilidade e toque), design-motion-principles (movimento) e awesome-claude-design (referência).

- A página é a comanda de papel: picote no topo, tinta vermelha, papel e mostarda.
- Cardápio completo com preços; cada item vai para a comanda, que soma, salva no aparelho e envia o pedido pelo WhatsApp (retirada ou entrega).
- Mostra se está aberto agora e destaca o dia de hoje no horário.
- Lanches desenhados em código; respeita "reduzir movimento"; conteúdo aparece mesmo sem JavaScript.

Antes de usar de verdade: trocar telefone (`PHONE` no script), endereço, cardápio, preços e as duas fotos de exemplo pelas reais.

Para ver: abra `hamburgueria/index.html` no navegador, ou acesse `/hamburgueria/` no GitHub Pages do repositório.

## Brasa 41 por dentro (`hamburgueria/imersivo/`)

Experiência 3D (Three.js) da mesma hamburgueria: você entra no salão e a rolagem monta o Brasa Duplo camada por camada.

- A rolagem é a do próprio navegador; a cena segue com inércia. Cada camada voa em arco, inclina no sentido do movimento, assenta e o queijo derrete ao cair na carne. Rolar para cima desmonta.
- Arrastar para os lados gira o lanche. No computador o mouse move a câmera de leve; em celulares Android, inclinar o aparelho também.
- Desempenho: a resolução baixa sozinha se o FPS cair (abaixo de ~47) e volta a subir quando sobra folga; a cena para de desenhar quando nada se mexe. Para ver o FPS no aparelho, abra o endereço com `?fps` no fim.
- Botão "Pausar" para a animação contínua; com "reduzir movimento" no sistema, a câmera fica parada; sem WebGL, aparece uma versão estática com o mesmo texto.
- "Pôr na comanda" adiciona o Brasa Duplo à comanda do site principal.

Código-fonte em `hamburgueria/imersivo/src/cena.js`; o arquivo publicado `cena.min.js` é gerado com `npm install && npm run build` dentro dessa pasta. Precisa de um servidor (GitHub Pages ou `python3 -m http.server`): aberto direto do disco, o navegador não carrega o módulo.
