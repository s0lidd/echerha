const fs = require('fs');

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

const HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'x-client-locale': 'uk',
    'x-device-id': '6f17abb3-d96a-4aaf-b964-57b9b0dbdabb',
    'x-device-name': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'x-user-agent': 'UABorder/3.10.0 Web/1.1.0 User/guest'
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function processCar(plate) {
    try {
        const searchUrl = `https://back.echerha.gov.ua/api/v5/workload/search?plate_number=${encodeURIComponent(plate)}`;
        const searchRes = await fetch(searchUrl, { headers: HEADERS });
        
        if (!searchRes.ok) return null;
        const searchData = await searchRes.json();

        if (!searchData.data || searchData.data.length === 0) return null;

        const carBase = searchData.data[0];

        if (carBase.queue_status === 50) return null;

        const detailsUrl = `https://back.echerha.gov.ua/api/v5/workload/1/checkpoints/${carBase.checkpoint_id}/details/${carBase.shared_type}/${carBase.queue_status}?page=1&plate_number=${encodeURIComponent(plate)}`;
        const detailsRes = await fetch(detailsUrl, { headers: HEADERS });
        
        if (!detailsRes.ok) return null;
        const detailsData = await detailsRes.json();
        const details = detailsData.data[0];
        
        if (details.time_on_inspection) return null;

        return {
            plate: plate,
            details: details,
            checkpoint: detailsData.checkpoint
        };
    } catch (error) {
        console.error(`Помилка для ${plate}:`, error.message);
        return null;
    }
}

async function run() {
    console.log('Початок сканування...');
    const startTime = Date.now();
    const results = [];

    const BATCH_SIZE = 2;
    const BATCH_DELAY = 1800; // Пауза 1.8 сек між пакетами

    for (let i = 0; i < cars.length; i += BATCH_SIZE) {
        const batch = cars.slice(i, i + BATCH_SIZE);
        console.log(`Сканування пакету [${i + 1}-${Math.min(i + BATCH_SIZE, cars.length)} з ${cars.length}]...`);

        const batchPromises = batch.map(plate => processCar(plate));
        const batchResults = await Promise.all(batchPromises);

        batchResults.forEach(res => {
            if (res) results.push(res);
        });

        if (i + BATCH_SIZE < cars.length) {
            await delay(BATCH_DELAY);
        }
    }

    const endTime = Date.now();
    const midTime = new Date((startTime + endTime) / 2);

    const finalData = {
        updatedAt: midTime.toISOString(),
        queues: results
    };

    fs.writeFileSync('data.json', JSON.stringify(finalData, null, 2));
    console.log(`Сканування завершено за ${((endTime - startTime) / 1000).toFixed(1)} сек! Збережено: ${results.length}`);
}

run();
