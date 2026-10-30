---
name: scroll-reveal-mobile
description: Use ao criar ou ajustar páginas mobile-first com elementos que aparecem e somem suavemente ao rolar (scroll reveal), cabeçalho que esconde ao descer, barra de progresso e efeitos ligados à rolagem, em HTML/CSS/JS puro. Referência viva em cafeteria/index.html.
---

# Scroll reveal para celular

Padrão usado em `cafeteria/index.html`. Copie de lá; este arquivo resume as regras.

## Regras

1. **Só `transform` e `opacity`.** Nada de animar `top`, `height`, `margin`.
2. **Curvas fixas** (não invente outras):
   - `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` para entrar e sair.
   - `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` para algo que se move na tela (indicador de aba).
3. **Durações:** revelar ao rolar 600–800 ms; cabeçalho 250 ms; aba 200–280 ms; toque em botão 100–160 ms.
4. **Página completa sem JS.** O estado escondido só vale com a classe `.reveal-ready` no `<html>`,
   que o script adiciona *depois* de marcar com `data-visible` o que já está na tela. Assim nada pisca ao carregar.
5. **Aparece e some com direção.** Ao sair da tela, o elemento recebe `data-side="above"` (saiu por cima)
   ou `"below"` (saiu por baixo) e desliza para esse lado. Ao voltar, entra pelo mesmo lado.
6. **Escalonamento:** `style="--i:N"` + `transition-delay: calc(var(--i) * 70ms)` só ao entrar; ao sair, sem atraso.
7. **Efeitos ligados à rolagem** (progresso, parallax, linha que enche): um único listener `scroll`
   com `{ passive: true }` que agenda `requestAnimationFrame`. Escreva `transform` direto no elemento.
8. **Movimento reduzido:** em `prefers-reduced-motion: reduce`, mantenha só o fade de opacidade (300 ms),
   tire deslocamentos, parallax e animações em loop.
9. **Hover só com mouse:** envolva em `@media (hover: hover) and (pointer: fine)`.
10. **Nunca** `transition: all`, `scale(0)` ou `ease-in`.

## Esqueleto

```css
[data-reveal] { transition: opacity 700ms var(--ease-out), transform 700ms var(--ease-out); }
.reveal-ready [data-reveal]:not([data-visible]) { opacity: 0; transform: translateY(32px) scale(.98); }
.reveal-ready [data-reveal][data-side="above"]:not([data-visible]) { transform: translateY(-32px) scale(.98); }
.reveal-ready [data-reveal][data-visible] { transition-delay: calc(var(--i, 0) * 70ms); }
```

```js
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) { e.target.removeAttribute("data-side"); e.target.setAttribute("data-visible", ""); }
    else { e.target.setAttribute("data-side", e.boundingClientRect.top < 0 ? "above" : "below"); e.target.removeAttribute("data-visible"); }
  }
}, { rootMargin: "-6% 0px -6% 0px" });
```

## Conferir antes de entregar

- Playwright em 390×844 (iPhone 13) e 320×568: `document.documentElement.scrollWidth` igual à largura da tela.
- Rolar para baixo e para cima: cabeçalho some e volta; elementos somem para o lado certo.
- Sem erros no console, nos temas claro e escuro.
