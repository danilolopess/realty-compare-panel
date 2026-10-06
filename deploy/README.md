# Painel na VPS (`casa.danilolopes.dev`)

Uso pontual. Este diretório sobe **só** o painel, com Postgres próprio, em `/opt/realty-compare`. Não entra no Compose de `/opt/vps-mini` e não cria base no Postgres do chat, do n8n ou da newsletter.

O `docker compose` da raiz deste repositório continua sendo o de desenvolvimento (portas 5432 e 3000 nesta máquina). Na VPS essas portas já estão ocupadas; o Compose de `deploy/` não publica porta nenhuma.

## O que fica isolado

| | Este painel | Stack já no ar |
|---|---|---|
| Diretório | `/opt/realty-compare` | `/opt/vps-mini` |
| Postgres | contêiner `realty-db`, volume `realty-compare_pgdata` | volume `vps-mini_postgres_data` |
| Site | `casa.danilolopes.dev` | chat, n8n, news |

O único contacto é o Caddy que já escuta 80/443. O script acrescenta um bloco marcado no `/opt/vps-mini/Caddyfile` **da VPS** e recarrega o Caddy. O git do `vps-mini` não muda. Um `rsync` desse repositório repõe o Caddyfile e tira o hostname até você rodar de novo `deploy/caddy-apply.sh`.

A VPS tem 2 GB e a stack atual já está no teto. Estes contêineres têm teto próprio (Postgres 96m, PostgREST 48m, site 128m). Enquanto o painel estiver no ar, o swap pode subir e o chat ou o n8n podem ficar mais lentos.

## Antes de subir

1. No Cloudflare, o registro **A** `casa` aponta para `192.255.242.108`. Deixe em **DNS only** (nuvem cinza) até o Caddy emitir o certificado. Proxy laranja só depois, com SSL **Full (strict)**.
2. O `.env` da raiz tem `VITE_LLM_API_KEY` (entra no JavaScript), mais `AUTH_EMAIL`, `AUTH_SECRET` e `AUTH_PASSWORD_HASH`. Não use os valores de exemplo. `AUTH_SECRET` sai de `openssl rand -hex 32`. O hash da senha do painel sai de `npm run hash-password` (é base64, sem `$`). Quem abrir o site consegue ler a chave do modelo no JavaScript. Ao remover o site, troque essa chave no provedor.
3. Crie a senha do Postgres deste app (não vai para o git):

```bash
cp deploy/env.example deploy/vps.env
chmod 600 deploy/vps.env
```

Pode deixar `POSTGRES_PASSWORD` vazio: `deploy.sh` gera uma senha hexadecimal e grava no mesmo arquivo. Não use `@`, `:` , `/` ou `#` se for preencher a senha à mão.

## Subir

Na raiz deste repositório, neste WSL (não compile na VPS):

```bash
bash deploy/deploy.sh
```

O script constrói a imagem aqui, envia com `docker save | ssh docker load`, sobe os três contêineres e recarrega o Caddy. A imagem oficial do Postgres 16 e a do PostgREST v16.4 são baixadas na VPS; a imagem do site não.

Na primeira resposta HTTPS, o Caddy pede o certificado. Acompanhe:

```bash
sudo ssh racknerd-4351839 'docker compose -f /opt/vps-mini/compose.yaml logs caddy --tail=40'
```

Quando o certificado existir, você pode ligar a nuvem laranja no Cloudflare.

## Conferir

```bash
curl -sI https://casa.danilolopes.dev/login | head -n 5
```

A resposta é **200**. No navegador, entre com o `AUTH_EMAIL` e a senha cujo hash está no `.env`. Esse login protege os imóveis.

Na VPS:

```bash
sudo ssh racknerd-4351839 'docker compose -f /opt/realty-compare/compose.yaml ps'
sudo ssh racknerd-4351839 'docker compose -f /opt/vps-mini/compose.yaml ps'
```

O segundo comando tem de continuar com Caddy, Open WebUI, n8n, Postgres e homepage no ar.

Sem um dump, a base sobe vazia, só com o schema de `docker/init.sql`. O `init.sql` roda apenas na primeira criação do volume.

## Levar os imóveis desta máquina (opcional)

Com o Postgres local no ar (`docker compose up -d` na raiz):

```bash
mkdir -p backup
docker compose exec -T db pg_dump -U user -d imoveis --data-only > backup/imoveis.sql
sudo ssh racknerd-4351839 'docker exec -i realty-db psql -U user -d imoveis -v ON_ERROR_STOP=1' < backup/imoveis.sql
```

`backup/` não entra no git. O arquivo tem notas, WhatsApp e conversas.

## Se você publicar de novo o vps-mini

O `rsync` para `/opt/vps-mini` troca o Caddyfile e o bloco do `casa` some. Os contêineres do painel continuam. Para recolocar o hostname:

```bash
bash deploy/caddy-apply.sh
```

## Remover tudo

```bash
bash deploy/remove.sh
```

Isso apaga o bloco do Caddy, o volume do Postgres **deste** app, os contêineres, a imagem `realty-compare-web` e o diretório `/opt/realty-compare`. Não apaga volumes `vps-mini_*`.

Depois, revogue ou troque a chave de API que estava no site.

Se as imagens `postgres:16-alpine` ou `postgrest/postgrest:v16.4` ainda aparecerem em `docker images` na VPS, outro contêiner as usa e o script as deixou. Sem uso, o próprio `remove.sh` já as apaga.
