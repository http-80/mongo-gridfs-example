import express from 'express'
import path from 'path'
import formidable from 'formidable'
import mongoose from 'mongoose'
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import fs, { read } from 'fs';

var conn = mongoose.connection;

config();

const app = express();

function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
  
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
  
    return result;
  }

conn.once("open", () => {
    console.log("Mongo ready steady bizz lezzgo!");
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'upload.html'));
});

app.post('/upload', (req, res) => {
    const form = formidable({
        maxFileSize: 2048 * 1024 * 1024
    });

    form.parse(req, async (err, fields, files) => {
        try {
            const file = files.file;
            const rand = generateRandomString(16);
            console.log(file);
            const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db);
            
            const writeStream = bucket.openUploadStream(rand + "." + file[0].originalFilename.split('.').at(-1), {
                chunkSizeBytes: 1048576,
                metadata: { user: 'gibi', mime: file[0].mimetype, originalName: file[0].originalFilename, ext: file[0].originalFilename.split('.').at(-1) }
            });

            const readStream = fs.createReadStream(file[0].filepath);

            writeStream.on('close', () => {
                console.log('Upload complete, view at http://localhost:3000/file/' + rand + "." + file[0].originalFilename.split('.').at(-1));
            });
            
            writeStream.on('error', (error) => {
                console.error('Error during upload:', error);
            });
            
            let uploadedBytes = 0;
            let totalSize = fs.statSync(file[0].filepath).size;
            readStream.on('data', (chunk) => {
                uploadedBytes += chunk.length;
                const percentage = ((uploadedBytes / totalSize) * 100).toFixed(2)
                console.log(`Uploaded ${uploadedBytes} bytes, aka ${percentage}%`);
            });

            readStream.pipe(writeStream);

            res.redirect('/')
        } catch(e) {
            console.log('error', e);
        } 
    });
});

app.get('/file/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
  
    try {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db);
      //const downloadStream = bucket.openDownloadStreamByName(fileId);
      const bucketFind = bucket.find({ filename: fileId })
      const file = await bucketFind.next();
      if (!file) return res.send('no file found.')
      const downloadStream = bucket.openDownloadStream(file._id);

      res.setHeader('Content-Type', file?.metadata?.mime ?? "video/mp4");

      downloadStream.pipe(res);
    } catch (error) {
      console.error('Error retrieving file:', error);
      res.status(500).send('Error retrieving file');
    }
  });

app.get('/files', async(req, res) => {
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db);
    const files = bucket.find({});

    let filesToSend = [];
    for await (const file of files) {
        filesToSend.push(file);
    }

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(filesToSend))

});

mongoose.connect(process.env.MONGO_URI);
app.listen(3000, () => console.log('online at http://localhost:3000'))