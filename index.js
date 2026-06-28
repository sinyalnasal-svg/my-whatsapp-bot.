const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@adiwajshing/baileys');
const { state, saveState } = useSingleFileAuthState('./session.json');
const qrcode = require('qrcode-terminal');

function startBot() {
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveState);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('=== امسحي الكود التالي عبر الواتساب لتشغيل البوت ===');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('تم قطع الاتصال بسبب: ', lastDisconnect.error, '، جاري إعادة الاتصال... ', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('تم تشغيل البوت بنجاح وهو جاهز لحماية المجموعات الآن!');
        }
    });

    // كود مراقبة الأعضاء الجدد وطرد الأرقام المخالفة
    sock.ev.on('group-participants.update', async (anu) => {
        try {
            // نتحقق فقط إذا كان هناك أعضاء جدد تم إضافتهم أو دخلوا برابط
            if (anu.action === 'add') {
                const metadata = await sock.groupMetadata(anu.id);
                
                for (let num of anu.participants) {
                    // التحقق إذا كان الرقم يبدأ بالرمز الدولي المخالف (مثال: +1 أو غيره)
                    // يمكنكِ تعديل '1' لأي رمز دولة ترغبين بحظره تلقائياً
                    if (num.startsWith('1')) { 
                        console.log(`تم رصد رقم مخالف: ${num}، جاري طرده تلقائياً...`);
                        
                        // أمر الطرد من المجموعة
                        await sock.groupParticipantsUpdate(anu.id, [num], 'remove');
                    }
                }
            }
        } catch (err) {
            console.log('حدث خطأ أثناء فحص العضو الجديد: ', err);
        }
    });
}

// تشغيل سيرفر وهمي بسيط لكي يقبله موقع Render للبقاء صاحي دائماً
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is Active\n');
});
server.listen(process.env.PORT || 3000, () => {
    console.log('Server is running...');
    startBot();
});
