const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const chokidar = require('chokidar');
const dns = require('dns').promises;
require('dotenv').config();

const folderPath = './dataset';  // Path ke folder dataset
const loggerStoragePath = './logger-storage';  // Path ke folder logger-storage

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

// Fungsi untuk mengupload file gambar
async function uploadImage(filePath) {
    try {
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath));  // Pastikan nama field sesuai

        // Tunggu hingga koneksi internet tersedia
        await waitForInternetConnection();

        const response = await axios.post('http://upload.xsmartagrichain.com/upload/image', formData, {
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

// Fungsi untuk memproses seluruh gambar dalam folder
async function processImagesInFolder() {
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const ext = path.extname(file).toLowerCase();

        // Cek apakah file tersebut adalah gambar
        if (['.jpg', '.jpeg', '.png'].includes(ext)) {
            await uploadImage(filePath);
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

            // Cek apakah file baru tersebut adalah gambar
            if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                console.log(`New file detected: ${filePath}`);
                await uploadImage(filePath);
            }
        })
        .on('error', error => console.error(`Watcher error: ${error}`));
}

// Fungsi utama
async function main() {
    // Proses gambar yang sudah ada di folder
    await processImagesInFolder();

    // Pantau folder untuk file baru
    watchFolder();
}

main();
