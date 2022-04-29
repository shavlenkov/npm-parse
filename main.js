require('dotenv').config();

const fs = require('fs');
const cors = require('cors');
const cron = require('node-cron');
const express = require('express');
const axiosClassic = require('axios');
const date = require('date-and-time');
const rateLimit = require('axios-rate-limit');
const TelegramBot = require('node-telegram-bot-api');

const app = express();

const axios = rateLimit(axiosClassic.create(), { maxRPS: 50 });

const token = process.env.TOKEN;
const ChannelId = process.env.ID;

const bot = new TelegramBot(token, { polling: true });

let hours;
const categories = ['frontend', 'backend', 'cli', 'documentation', 'css', 'testing', 'iot', 'coverage', 'mobile', 'framework', 'robotics', 'math'];
const phrases = [
    'А вот и новый пакет!',
    'Какая неожиданность, ведь вышел новый пакет!',
    'Если ты искал годный пакет, то тебе сюда!',
    'Мы снова рады тебя видеть!',
    'Не давай злым силам одолеть тебя, а лучше возьми новый пакет!',
    'Если что, в пакетах, которые мы тебе даем - ничего запрещенного нет, так что не переживай)',
    'Возможности купить счастье нет, но у тебя есть возможность чекнуть новый пакет ( что впринципе одно и тоже :) )',
    'IF(ты не счастлив) {дать пакет} ELSE {все равно дать пакет}',
    'Конечно ты можешь начать день с чего-то другого, но лучше начни его с нового фреймворка!',
    'Никогда не поздно начать день с нового фреймворка!',
    'Как-никак, а пакеты всегда будут появляться!',
    'А кто тут у нас ещё пакет не чекнул, а?',
    'Мы будем очень рады, если ты будешь заходить на этот канал почаще :)',
    'Ура! Вышел новый пакет.',
    'GET 200 OK (Запрос на получение нового пакета прошел успешно!)',
    'Hello, npm package!'
];
let random;
async function updateRequiredData() {
  const later = new Date();
  const start = new Date();
  const end = new Date();

  start.setDate(start.getDate() - 7);
  later.setDate(later.getDate() - 14);

  const phraseHours = new Date();
  random = Math.floor(Math.random() * phrases.length);
  return {
    laterDate: date.format(later, 'YYYY-MM-DD'),
    endDate: date.format(end, 'YYYY-MM-DD'),
    startDate: date.format(start, 'YYYY-MM-DD'),
    hours: phraseHours.getHours() + 2,
    random: random
  };
}

async function get() {
  const results = [];

  for (const item of categories) {
    const { data } = await axios.get(`https://api.npms.io/v2/search/?q=keywords:${item}+popularity-weight:100+not:insecure`);

    data.results.map(obj => {
        obj["package"]["category"] = item;
    });

    results.push(data.results);
  }

  return results;
}

let serverData = null;

async function output(finalResult) {
  const { laterDate, startDate, hours, random } = await updateRequiredData();

  let PackageNumber = Math.floor(Math.random() * finalResult.length);
  const {
    name, link, descr, date, downloads, category,
  } = finalResult[PackageNumber];

  const { data } = await axios.get(`https://api.npmjs.org/downloads/point/${laterDate}:${startDate}/${name}`);
  const percent = Math.floor((downloads * 100 / data.downloads));
  try {
    if (JSON.parse(fs.readFileSync('blacklist.json', 'utf8')).indexOf(name) === -1 && percent > 80 && downloads >= 1000 && downloads < 3500000 && date.split('T')[0].split('-')[0] >= 2021) {
      const temp = JSON.parse(fs.readFileSync('blacklist.json', 'utf8'));
      temp.push(name);

      bot.sendMessage(ChannelId, `${phrases[random]}\n\n☑ Название: ${name}\n📋 Описание: ${descr}\n📁 Категория: ${category}\n📊 Скачиваний за неделю: ${downloads}\n⚡ Ссылка: ${link}\n📅 Дата создания: ${date.split('T')[0]}`);
      serverData = {
        name,
        descr,
        downloads,
        date: date.split('T')[0],
        link,
        category,
      };

      fs.writeFileSync('blacklist.json', JSON.stringify(temp));
    } else {
      PackageNumber = Math.floor(Math.random() * finalResult.length);
      await output(finalResult);
    }
  } catch (e) {
    console.log(e)
    await output(finalResult);
  }
}

cron.schedule('0 9 * * *', async () => {
  const content = await get();

  const { endDate, startDate } = await updateRequiredData();

  const result = await Promise.all(
      content.map(async (item) => Promise.all(item.map(async (obj) => {
        const { data } = await axios.get(`https://api.npmjs.org/downloads/point/${startDate}:${endDate}/${obj.package.name}`);

        return {
          name: obj.package.name,
          link: obj.package.links.npm,
          descr: obj.package.description,
          date: obj.package.date,
          downloads: data.downloads,
          category: obj.package.category,
        };
      }))),
  );

  const finalResult = result.flat().sort((a, b) => new Date(b.date) - new Date(a.date));

  await output(finalResult);
  console.log(serverData);
}, {
  timezone: 'Europe/Kiev',
});

app.use(cors());

app.get('/api/v1/npm-parse', (req, res) => {
  res.send({
    result: serverData || null,
  });
});

const port = 3000;

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
