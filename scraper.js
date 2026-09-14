const fs = require('fs');
const crypto = require('crypto');

const cars = [
    'CE 0276 ET',
    'CE 0285 ET',
    'CE 0947 BK',
    'CE 0948 BK',
    'CE 0989 BK',
    'CE 0993 BK',
    'CE 0994 BK',
    'CE 0995 BK',
    'CE 1714 CO',
    'CE 1715 CO',
    'CE 1716 CO',
    'CE 2115 AT',
    'CE 2432 BA',
    'CE 2486 BA',
    'CE 2575 EI',
    'CE 2667 AT',
    'CE 2714 BE',
    'CE 2735 BM',
    'CE 2767 BE',
    'CE 3129 BC',
    'CE 3132 BC',
    'CE 3227 BC',
    'CE 3228 BC',
    'CE 3228 EI',
    'CE 3229 EI',
    'CE 3408 CO',
    'CE 3965 CO',
    'CE 4326 HB',
    'CE 4389 BB',
    'CE 5021 EI',
    'CE 5022 EI',
    'CE 5023 EI',
    'CE 5940 EK',
    'CE 5950 EK',
    'CE 6347 BB',
    'CE 6757 EH',
    'CE 6758 EH',
    'CE 6941 BE',
    'CE 6995 BE',
    'CE 7365 AX',
    'CE 7385 AX',
    'CE 7442 BC',
    'CE 7588 EP',
    'CE 8299 AP',
    'CE 8344 AM',
    'CE 9855 BE',
    'CE 9860 BE',
    'CE 9876 BE'
];

const sessionDeviceId = crypto.randomUUID();
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:156.0) Gecko/20100101 Firefox/156.0';

let sessionCookies = '';

function getHeaders() {
    const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
        'Accept-Language': 'uk-UA,uk;q=0.9,ru;q=0.8,en-US;q=0.7,en;q=0.6',
        'Connection': 'keep-alive',
        'Origin': 'https://echerha.gov.ua',
        'Referer': 'https://echerha.gov.ua/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'User-Agent': USER_AGENT,
        'x-client-locale': 'uk',
        'x-device-id': sessionDeviceId,
        'x-device-name': USER_AGENT,
        'x-user-agent': 'UABorder/3.11.0 Web/1.1.0 User/guest'
    };
    if (sessionCookies) {
        headers['Cookie'] = sessionCookies;
    }
    return headers;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function updateCookies(response) {
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
        const cookies = setCookieHeader.split(',').map(c => c.split(';')[0]);
        sessionCookies = cookies.join('; ');
    }
}

async function safeFetch(url) {
    while (true) {
        try {
            const res = await fetch(url, { headers: getHeaders() });
            updateCookies(res);

            if (res.status === 429) {
                console.log(`└ ⏳ Ліміт запитів (429). Пауза…`);
                await delay(8000);
                continue;
            }

            return res;
        } catch (err) {
            console.log(`└ ⚠️ Мережева помилка. Пауза…`);
            await delay(5000);
        }
    }
}

async function processCar(plate) {
    try {
        const searchUrl = `https://back.echerha.gov.ua/api/v5/workload/search?plate_number=${encodeURIComponent(plate)}`;
        const searchRes = await safeFetch(searchUrl);

        if (searchRes.status === 404) {
            console.log(`└ ⚪ Немає в черзі (404)`);
            return null;
        }
        
        const rawText = await searchRes.text();

        if (!searchRes.ok) {
            console.log(`└ ❌ Відмовлено сервером (HTTP ${searchRes.status})`);
            return null;
        }

        let searchData;
        try {
            searchData = JSON.parse(rawText);
        } catch (e) {
            console.log(`└ 🛑 Блокування (Капча/HTML)`);
            return null;
        }

        if (!searchData.data || searchData.data.length === 0) {
            console.log(`└ ⚪ Немає в черзі`);
            return null;
        }

        const carBase = searchData.data[0];

        if (carBase.queue_status === 50) {
            console.log(`└ 🟢 На контролі`);
            return null;
        }

        const detailsUrl = `https://back.echerha.gov.ua/api/v5/workload/1/checkpoints/${carBase.checkpoint_id}/details/${carBase.shared_type}/${carBase.queue_status}?page=1&plate_number=${encodeURIComponent(plate)}`;
        const detailsRes = await safeFetch(detailsUrl);

        if (detailsRes.status === 404) {
            console.log(`└ ⚪ Деталі не знайдені (404)`);
            return null;
        }
        
        const rawDetailsText = await detailsRes.text();
        
        if (!detailsRes.ok) {
            console.log(`└ ❌ Помилка деталей (HTTP ${detailsRes.status})`);
            return null;
        }

        let detailsData;
        try {
            detailsData = JSON.parse(rawDetailsText);
        } catch (e) {
            console.log(`└ 🛑 Блокування на деталях (Капча/HTML)`);
            return null;
        }

        const details = detailsData.data[0];
        
        if (details.time_on_inspection) {
            console.log(`└ 🟡 На інспекції`);
            return null;
        }

        console.log(`└ ✅ Успішно знайдено!`);
        return {
            plate: plate,
            details: details,
            checkpoint: detailsData.checkpoint
        };
    } catch (error) {
        console.error(`  ⚠️ Помилка виконання:`, error.message);
        return null;
    }
}

async function run() {
    console.log('Початок сканування…');
    console.log(`Session ID: ${sessionDeviceId}`);
    const startTime = Date.now();
    const results = [];

    for (let i = 0; i < cars.length; i++) {
        console.log(`\n[${i+1}/${cars.length}] Перевірка: ${cars[i]}`);
        const data = await processCar(cars[i]);
        if (data) results.push(data);
        
        if (i < cars.length - 1) {
            await delay(800 + Math.random() * 400);
        }
    }

    const endTime = Date.now();
    const midTime = new Date((startTime + endTime) / 2);

    const finalData = {
        updatedAt: midTime.toISOString(),
        queues: results
    };

    fs.writeFileSync('data.json', JSON.stringify(finalData, null, 2));
    console.log(`\n🎉 Сканування завершено за ${((endTime - startTime) / 1000).toFixed(1)} сек! Збережено машин: ${results.length}`);
}

run();
