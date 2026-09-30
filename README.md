# Lab-4 Avaliação Funcional (versão 2.0)

Aplicação de avaliação funcional da Lab-4 Performance, para celular (iPhone e Android) e computador, com relatório A4 de 6 páginas em PDF vetorial. Funciona sem internet depois da primeira abertura, e os dados ficam somente no aparelho de quem avalia.

## Como a equipe usa

O compartilhamento entre profissionais é feito por **link**, e não por arquivo. Quem recebe o link pelo WhatsApp abre no navegador e instala o app na tela de início:

- **iPhone:** abrir o link no Safari, tocar em Compartilhar e depois em "Adicionar à Tela de Início".
- **Android:** abrir no Chrome e tocar em "Instalar" no aviso da própria aplicação, ou no menu do navegador.

A instalação é importante no iPhone. O Safari apaga dados de sites após sete dias sem uso, mas apps instalados na tela de início ficam isentos dessa limpeza.

O relatório é gerado pelo botão **Gerar PDF**. No celular, o botão **Compartilhar** abre a folha nativa do aparelho, de onde o PDF vai direto para o WhatsApp, o e-mail ou o app Arquivos.

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie o conteúdo desta pasta para a branch `main`.
2. Em **Settings > Pages**, escolha **Source: GitHub Actions**.
3. A cada push, o workflow `.github/workflows/deploy.yml` roda os testes, compila e publica. O endereço aparece na aba Actions, no formato `https://<usuario>.github.io/<repositorio>/`.

Se preferir não usar o Actions, publique o conteúdo de `dist/` (o pacote `lab4-pwa-dist.zip` já vem compilado) em qualquer hospedagem estática com HTTPS, como Cloudflare Pages ou Netlify. O HTTPS é obrigatório para o service worker e para o compartilhamento de arquivos.

Um repositório público expõe apenas o código. Nenhum dado de atleta passa pelo servidor.

## Desenvolvimento

É necessário Node.js 20 ou superior.

```bash
npm install
npm run dev          # servidor local com recarga automática
npm test             # testes do motor de relatório (Node, sem navegador)
npm run build        # gera dist/ (PWA) e dist-single/index.html (arquivo único)
npm run preview      # serve dist/ localmente para testar o PWA
```

Para testar no celular durante o desenvolvimento, rode `npx vite --host` e abra o endereço de rede no aparelho, na mesma rede Wi-Fi. Service worker e compartilhamento de arquivos só funcionam por HTTPS ou em `localhost`, então essa parte deve ser validada no endereço publicado.

## Arquitetura

```
src/
  core/config.js      testes, rótulos, frases rápidas e limites (fonte única)
  core/model.js       estado, migração de esquema, cálculos (idade, IMC, diferenças)
  report/layout.js    motor de layout A4: estado → lista de desenho em milímetros
  report/pdf.js       lista de desenho → PDF vetorial (pdf-lib, fontes em subconjunto)
  report/svg.js       lista de desenho → SVG da pré-visualização
  report/engine.js    carga sob demanda do motor no navegador
  storage/db.js       IndexedDB, com alternativa em memória
  storage/repo.js     avaliações, fotos, exportação/importação e migração da v1
  ui/*                formulário, fotos, diálogos, compartilhamento e PWA
  app.js              controlador (estado, autosalvamento, comandos)
tests/                testes automatizados do motor (node:test)
```

A decisão central é o **motor de layout único**. A pré-visualização e o PDF são desenhados a partir da mesma lista de elementos, com as mesmas coordenadas e as mesmas quebras de linha. Por isso, o que aparece na tela é exatamente o que sai no arquivo. A largura do texto é medida com as próprias fontes Barlow, e não com o navegador, o que torna o PDF idêntico em qualquer aparelho. O `window.print()` foi abandonado porque o Safari do iOS ignora o tamanho de página A4 definido em CSS.

Os testes em `tests/report.test.mjs` verificam:

- as 6 páginas em A4 exato;
- que nenhum texto ou imagem ultrapassa as margens;
- a detecção de excesso de conteúdo por página;
- o tamanho do PDF sem fotos, abaixo de 250 KB.

Qualquer alteração de layout deve manter esses testes passando.

## Dados e privacidade

Os dados ficam no IndexedDB do aparelho. As fotos são comprimidas no próprio celular, para no máximo 1200 px, em JPEG. Rascunhos da versão 1 (localStorage) são migrados automaticamente quando a versão 2 é aberta no mesmo endereço. O botão **Exportar** gera um `.json` com todos os campos e fotos, compatível com a versão 1, para backup ou para transferir entre aparelhos.

As avaliações contêm dados de saúde, que a LGPD classifica como dados pessoais sensíveis. Vale definir internamente quem pode receber os PDFs e por quanto tempo eles são guardados.

## Roteiro de testes em aparelhos (Etapa 3)

Validado em Chromium com emulação de celular. Ainda precisa ser confirmado em aparelhos reais, idealmente num iPhone com iOS 16 ou superior e num Android com Chrome recente:

- [ ] Abrir o link recebido pelo WhatsApp e instalar na tela de início.
- [ ] Fechar o app, colocar o aparelho em modo avião e reabrir: deve funcionar normalmente.
- [ ] Tirar fotos pela opção **Câmera** e escolher pela **Galeria** (no iPhone, conferir fotos HEIC).
- [ ] Conferir se as fotos aparecem com a orientação correta (retrato e paisagem).
- [ ] Preencher uma avaliação completa, fechar o app e reabrir: tudo deve estar lá.
- [ ] Gerar o PDF, tocar em **Compartilhar** e enviar pelo WhatsApp; abrir o PDF recebido em outro aparelho.
- [ ] Imprimir o PDF numa impressora A4 e conferir margens e cortes.
- [ ] Criar uma segunda avaliação, alternar entre elas em **Avaliações** e excluir uma.
- [ ] Exportar no celular, importar no computador (arquivo único) e vice-versa.
- [ ] Testar em tela pequena (iPhone SE ou similar) e com o texto do sistema ampliado.
