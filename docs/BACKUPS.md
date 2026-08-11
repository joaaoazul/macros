# Backups da base de dados (Backblaze B2)

Tudo o que os utilizadores registam — diário, peso, receitas, mensagens — vive
num só volume Postgres no VPS. Se esse volume se perder, perde-se tudo, e são
dados de saúde de outras pessoas. Isto põe uma cópia cifrada fora da máquina,
todos os dias, com ensaio de restauro semanal.

O que **não** está aqui: os ficheiros do `.env` (segredos) nem a configuração
do rclone. Guarda esses num gestor de passwords — sem eles um backup não se
restaura.

---

## 1. Criar o bucket no Backblaze

1. Conta B2 → *Buckets* → **Create a Bucket**.
   - Nome: `macros-backups` (é global, pode ser preciso outro)
   - **Private**
   - *Object Lock*: desligado
2. *App Keys* → **Add a New Application Key**:
   - Restringe ao bucket `macros-backups`
   - Permissões: *Read and Write*
3. Guarda o `keyID` e o `applicationKey` — a chave só aparece uma vez.

Convém pôr uma *Lifecycle Rule* no bucket a apagar versões antigas, senão as
versões anteriores acumulam-se e vais pagar por elas.

## 2. Instalar e configurar o rclone no VPS

```bash
sudo apt install rclone     # ou: curl https://rclone.org/install.sh | sudo bash
sudo rclone config
```

`n` (novo remote) → nome **`b2`** → tipo **Backblaze B2** → `account` = keyID,
`key` = applicationKey → resto por omissão.

Confirma:

```bash
sudo rclone lsd b2:
```

## 3. Configurar o projeto

No `.env` (ver `.env.example`):

```properties
BACKUP_REMOTE=b2:macros-backups/db
BACKUP_PASSPHRASE=<gera com: openssl rand -base64 32>
BACKUP_KEEP_LOCAL=7
BACKUP_KEEP_REMOTE_DAYS=90
```

> **A passphrase é tão importante como os backups.** O dump é cifrado com
> AES-256 antes de sair da máquina, o que é o correcto para dados de saúde —
> mas quer dizer que sem a passphrase os ficheiros no B2 não valem nada.
> Guarda-a no gestor de passwords, **noutro sítio que não o VPS**.

Se preferires não cifrar, deixa `BACKUP_PASSPHRASE` vazia — passa a confiar só
na cifra em repouso do lado do Backblaze.

## 4. Correr à mão uma vez

```bash
./deploy/backup-db.sh
./deploy/restore-db.sh --latest   # ensaio: não toca na produção
```

O ensaio restaura para uma base temporária, conta as tabelas e as linhas,
confirma que há utilizadores e apaga a base no fim. É isto que distingue um
backup de um ficheiro que se espera que sirva.

## 5. Automatizar

```bash
sudo cp deploy/macros-backup*.service deploy/macros-backup*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now macros-backup.timer macros-backup-verify.timer
systemctl list-timers 'macros-*'
```

Diário às 04:00 (com folga aleatória), ensaio de restauro aos domingos às 05:00.
Os units apontam para `/opt/macros` — corrige o `WorkingDirectory` se clonaste
noutro sítio.

Ver o que aconteceu:

```bash
journalctl -u macros-backup.service -n 50
journalctl -u macros-backup-verify.service -n 50
```

Se tiveres `ALERT_NTFY_URL` definido, uma falha do backup manda notificação —
vale a pena, porque a maneira habitual de ficar sem backups é eles pararem sem
ninguém reparar.

## 6. Restaurar a sério

```bash
# do B2, se a máquina se perdeu
rclone copy b2:macros-backups/db/macros-20260811-040000Z.sql.gz.enc ./backups/

./deploy/restore-db.sh --latest --force
```

O `--force` escreve por cima da base de produção e pede-te para escreveres o
nome da base a confirmar. Pára o backend primeiro
(`docker compose stop backend`) para nada estar a escrever durante o restauro,
e volta a arrancá-lo no fim.

---

## Notas

- O dump sai com `--no-owner --no-privileges`, por isso restaura para qualquer
  utilizador de Postgres, não só o original.
- Um backup interrompido a meio nunca fica com nome de backup bom: escreve-se
  para ficheiro temporário e só se renomeia no fim.
- `BACKUP_DB_DIRECT=1` faz os scripts usarem o `pg_dump` local em vez do
  contentor — serve para testes e para quem não corre em Docker.
- Isto cobre a base de dados. O VPS em si não está coberto: se quiseres
  recuperação completa da máquina, junta os snapshots do teu fornecedor.
