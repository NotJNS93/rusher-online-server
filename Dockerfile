# Usa uma imagem oficial do Node.js como base. A versão 18 é estável e recomendada.
FROM node:18-alpine

# Define o diretório de trabalho dentro do contêiner. É como criar uma pasta para o nosso app.
WORKDIR /usr/src/app

# Copia os arquivos que definem as dependências (package.json e package-lock.json)
# O '*' garante que ambos sejam copiados se existirem.
COPY package*.json ./

# Executa o comando para instalar todas as dependências listadas no package.json.
# Isso cria a pasta node_modules dentro do contêiner.
RUN npm install

# Copia todo o resto do código do nosso projeto (principalmente server.js) para o diretório de trabalho.
# O '.' significa "copiar tudo da pasta atual (no seu PC) para a pasta atual (WORKDIR no contêiner)".
COPY . .

# Informa ao Docker que o contêiner vai escutar na porta 3000.
# O Render usará essa informação para direcionar o tráfego.
EXPOSE 3000

# O comando final que será executado quando o contêiner iniciar.
# É o mesmo comando que usamos para iniciar o servidor manualmente.
CMD [ "node", "server.js" ]