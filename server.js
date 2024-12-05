const admin = require('firebase-admin');
const Hapi = require('@hapi/hapi');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Initialize Firebase
const serviceAccount = require('./path/to/your/serviceAccountKey.json'); // Path to your Firebase Admin SDK credentials

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://submissionmlgc-hilwa2.firebaseio.com"
});

const db = admin.firestore(); // Initialize Firestore

// Setup storage for multer (same as previous code)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 1000000 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') {
            return cb(new Error('Only image files are allowed'));
        }
        cb(null, true);
    }
});

const init = async () => {
    const server = Hapi.server({
        port: 4000,
        host: 'localhost',
    });

    // POST /predict for prediction logic
    server.route({
        method: 'POST',
        path: '/predict',
        options: {
            payload: {
                maxBytes: 1000000,
                parse: false,
                allow: 'multipart/form-data',
            },
            handler: async (request, h) => {
                return new Promise((resolve, reject) => {
                    upload.single('image')(request, {}, async (err) => {
                        if (err) {
                            if (err instanceof multer.MulterError) {
                                if (err.code === 'LIMIT_FILE_SIZE') {
                                    return reject({
                                        status: 'fail',
                                        message: 'Payload content length greater than maximum allowed: 1000000',
                                    });
                                }
                            }
                            return reject({
                                status: 'fail',
                                message: err.message || 'Terjadi kesalahan dalam melakukan prediksi',
                            });
                        }

                        const filePath = request.payload.filepath;
                        
                        // Simulate model prediction (replace with actual prediction logic)
                        const isCancer = Math.random() > 0.5; // Random prediction for simulation

                        // Save the prediction to Firestore
                        const predictionId = '77bd90fc-c126-4ceb-828d-f048dddff746';
                        const predictionData = {
                            id: predictionId,
                            result: isCancer ? 'Cancer' : 'Non-cancer',
                            suggestion: isCancer 
                                ? 'Segera periksa ke dokter!' 
                                : 'Penyakit kanker tidak terdeteksi.',
                            createdAt: new Date().toISOString(),
                        };

                        await db.collection('predictions').doc(predictionId).set(predictionData);

                        const result = {
                            status: 'success',
                            message: 'Model is predicted successfully',
                            data: predictionData,
                        };

                        resolve(result);
                    });
                });
            },
        },
    });

    // GET /predict/histories for retrieving prediction history
    server.route({
        method: 'GET',
        path: '/predict/histories',
        handler: async (request, h) => {
            try {
                // Retrieve prediction history from Firestore
                const snapshot = await db.collection('predictions').get();
                const histories = [];

                snapshot.forEach(doc => {
                    const historyData = doc.data();
                    histories.push({
                        id: historyData.id,
                        history: {
                            result: historyData.result,
                            createdAt: historyData.createdAt,
                            suggestion: historyData.suggestion,
                            id: historyData.id,
                        }
                    });
                });

                return {
                    status: 'success',
                    data: histories,
                };
            } catch (error) {
                return h.response({
                    status: 'fail',
                    message: 'Terjadi kesalahan dalam mengambil riwayat prediksi',
                }).code(500);
            }
        },
    });

    // Start server
    await server.start();
    console.log('Server running on %s', server.info.uri);
};

// Run the server
init().catch((err) => {
    console.log(err);
    process.exit(1);
});
