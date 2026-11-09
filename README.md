# EmPowerElas · Maquete 3D

Gêmeo digital e simulador da maquete de subestação digital do projeto EmPowerElas (FRIENDS Lab, UFF).

- `index.html`: página inicial com os dois links
- `gemeo/`: gêmeo digital (só observa a maquete; nesta versão, em modo demonstração)
- `simulador/`: simulador (os comandos acontecem só no navegador, nada chega à maquete física)
- `vendor/three/`: biblioteca 3D three.js 0.160.0 (licença MIT), para funcionar mesmo sem internet

## Publicar no GitHub Pages

1. Crie um repositório **público** (ex.: `empowerelas-3d`) e envie todos estes arquivos para a branch `main`.
2. No repositório: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**.
3. Em alguns minutos o site fica em `https://SEU-USUARIO.github.io/empowerelas-3d/`.

## Rodar na rede da maquete

Copie a pasta para a Raspberry ou o notebook e, dentro dela, rode:

```
python3 -m http.server 8080
```

Depois abra `http://IP-DO-COMPUTADOR:8080/` no navegador. O botão do supervisório pode apontar para `http://IP-DO-COMPUTADOR:8080/gemeo/`.

Abrir o `index.html` com duplo clique **não funciona**: o navegador bloqueia a leitura do `modelos.json`. Use sempre um servidor web.

## Atualizar

Troque os arquivos `gemeo/index.html` e `simulador/index.html` pelas versões novas (e o `modelos.json`, se mudar).

## Equipe

Os nomes e as fotos do painel "Quem fez" ficam no começo do código de `gemeo/index.html` e `simulador/index.html`, na lista `EQUIPE`. Fotos de menores de idade só com autorização dos responsáveis.
