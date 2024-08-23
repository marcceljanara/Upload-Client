const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const chokidar = require('chokidar');
const dns = require('dns').promises;
require('dotenv').config();

const folderPath = './dataset-models';  // Path ke folder dataset
const loggerStoragePath = './logger-models';  // Path ke folder logger-storage

const CHECK_INTERVAL_MS = 5000; // Interval pengecekan koneksi internet (5 detik)

// Fungsi untuk memeriksa koneksi internet
async function checkInternetConnection() {
    try {
        await dns.lookup('google.com');
        return true;
    } catch {
        return false;
    }
}

// Fungsi untuk menunggu hingga koneksi internet tersedia
async function waitForInternetConnection() {
    console.log('Waiting for internet connection...');
    while (!(await checkInternetConnection())) {
        await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
    }
    console.log('Internet connection is available.');
}

// Fungsi untuk mengupload file .h5
async function uploadH5(filePath) {
    try {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));  // Pastikan nama field sesuai

        // Tunggu hingga koneksi internet tersedia
        await waitForInternetConnection();

        const response = await axios.post('http://upload.xsmartagrichain.com/upload/h5', formData, {
            headers: {
                ...formData.getHeaders()
            }
        });

        console.log(`Successfully uploaded: ${path.basename(filePath)}`);
        
        // Pindahkan file setelah berhasil diupload
        const newFilePath = path.join(loggerStoragePath, path.basename(filePath));
        fs.renameSync(filePath, newFilePath);
        console.log(`Moved file to: ${newFilePath}`);
    } catch (error) {
        if (error.response) {
            console.error(`Failed to upload ${path.basename(filePath)}: ${error.response.data}`);
        } else {
            console.error(`Failed to upload ${path.basename(filePath)}: ${error.message}`);
        }
    }
}

// Fungsi untuk memproses seluruh file .h5 dalam folder
async function processH5InFolder() {
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const ext = path.extname(file).toLowerCase();

        // Cek apakah file tersebut adalah file .h5
        if (ext === '.h5') {
            await uploadH5(filePath);
        }
    }
}

// Pantau folder untuk file baru
function watchFolder() {
    const watcher = chokidar.watch(folderPath, {
        ignored: /^\./,
        persistent: true
    });

    watcher
        .on('add', async filePath => {
            const ext = path.extname(filePath).toLowerCase();

            // Cek apakah file baru tersebut adalah file .h5
            if (ext === '.h5') {
                console.log(`New file detected: ${filePath}`);
                await uploadH5(filePath);
            }
        })
        .on('error', error => console.error(`Watcher error: ${error}`));
}

// Fungsi utama
async function main() {
    // Proses file .h5 yang sudah ada di folder
    await processH5InFolder();

    // Pantau folder untuk file baru
    watchFolder();
}

main();
