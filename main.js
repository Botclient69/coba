const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@adiwajshing/baileys')
const { Boom } = require('@hapi/boom')
const { join } = require('path')
const P = require('pino')

const { state, saveState } = useSingleFileAuthState('./auth_info.json')

async function startBot() {
    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ['Bot WhatsApp', 'Safari', '1.0.0'],
    })

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error = Boom.isBoom(lastDisconnect.error) && lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut)
            if (shouldReconnect) {
                startBot()
            }
        } else if (connection === 'open') {
            console.log('Bot connected')
        }
    })

    sock.ev.on('messages.upsert', async (messageUpdate) => {
        const message = messageUpdate.messages[0]
        if (!message.key.fromMe && message.key.participant) {
            const from = message.key.remoteJid
            const text = message.message.conversation || message.message.extendedTextMessage?.text
            const sender = message.key.participant

            if (text?.toLowerCase() === 'hi bot') {
                await sock.sendMessage(from, { text: 'Hello! Saya adalah bot penjaga grup.' })
            } else if (text?.toLowerCase() === 'main game') {
                const angka = Math.floor(Math.random() * 10) + 1
                await sock.sendMessage(from, { text: `Tebak angka dari 1 sampai 10` })
                sock.ev.on('messages.upsert', async (gameMessage) => {
                    const guess = parseInt(gameMessage.messages[0].message.conversation)
                    if (guess === angka) {
                        await sock.sendMessage(from, { text: `Selamat, kamu benar! Angkanya adalah ${angka}.` })
                    } else {
                        await sock.sendMessage(from, { text: `Salah tebak! Coba lagi.` })
                    }
                })
            }
        }
    })

    sock.ev.on('group-participants.update', async (update) => {
        if (update.action === 'add') {
            await sock.sendMessage(update.id, { text: `Selamat datang di grup!` })
        } else if (update.action === 'remove') {
            await sock.sendMessage(update.id, { text: `Selamat jalan, semoga sukses di luar sana!` })
        }
    })

    sock.ev.on('creds.update', saveState)
}

startBot()
