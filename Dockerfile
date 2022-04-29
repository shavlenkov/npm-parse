FROM node:latest
RUN mkdir -p /usr/src/npm-parse
WORKDIR /usr/src/npm-parse
COPY . /usr/src/npm-parse
RUN npm install
CMD [ "npm", "start" ]
EXPOSE 3000
