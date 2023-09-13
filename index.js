const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios').default;
const { Configuration, OpenAIApi } = require("openai");
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const api = axios.create({
    baseURL: process.env.SHEETDB_URL,
    headers: {
        Authorization: 'Bearer ' + process.env.SHEETDB_KEY
    }
})

async function LoadWhats() {

    const client = new Client({
        puppeteer: {
            args: ['--no-sandbox'],
        },
        authStrategy: new LocalAuth()
    });

    client.initialize();

    client.on('loading_screen', (percent, message) => {
        console.log('LOADING SCREEN', percent, message);
    });

    client.on('qr', (qr) => {
        // NOTE: This event will not be fired if a session is specified.
        console.log('QR RECEIVED', qr);
    });

    client.on('authenticated', () => {
        console.log('AUTHENTICATED');
    });

    client.on('auth_failure', msg => {
        // Fired if session restore was unsuccessful
        console.error('AUTHENTICATION FAILURE', msg);
    });

    client.on('ready', () => {
        console.log('READY');
    });

    client.on('message', async msg => {

        const telefone = String(msg.rawData.from).split('@')[0]
        const nome = msg.rawData.notifyName
        const texto = msg.body

        const busca_usuario = await prisma.usuario.findUnique({
            where: {
                telefone
            },
        })

        if (!busca_usuario) {

            const system = process.env.SYSTEM_PROMPT

            const novo_usuario = await prisma.usuario.create({
                data: {
                    telefone,
                    nome,
                    chat: {
                        createMany: {
                            data: [{
                                content: system,
                                role: 'system'
                            },
                            {
                                content: `nome: ${nome}, mensagem: ${texto}`,
                                role: 'user'
                            }
                            ]
                        }
                    }
                },
            })

            const message = await prisma.chat.findMany({
                select: {
                    role: true,
                    content: true
                },
                where: {
                    id_usuario: novo_usuario.id
                }
            })

            const retorno_gpt = await RespostaGPT(message)

            await prisma.chat.create({
                data: {
                    content: retorno_gpt,
                    role: 'assistant',
                    id_usuario: novo_usuario.id,
                }
            })

            client.sendMessage(msg.from, retorno_gpt);

        } else {

            await prisma.chat.create({
                data: {
                    content: `nome: ${nome}, mensagem: ${texto}`,
                    id_usuario: busca_usuario.id,
                    role: 'user'
                }
            })

            const arrayMessage = await prisma.chat.findMany({
                select: {
                    role: true,
                    content: true
                },
                where: {
                    id_usuario: busca_usuario.id
                }
            })

            const retorno_gpt = await RespostaGPT(arrayMessage)

            await prisma.chat.create({
                data: {
                    content: retorno_gpt,
                    role: 'assistant',
                    id_usuario: busca_usuario.id,
                }
            })
            client.sendMessage(msg.from, retorno_gpt);

        }

        if (pesquisa_telefone[0]) {
            return
        }

        const data = [{
            nome,
            telefone
        }]

        await api.post('/', data)
            .then(response => {
                console.log(response.data)
            })
            .catch(error => {
                console.log(error)
            })

    });

}

async function RespostaGPT(arrayMessage) {

    const chat_completion = await openai.createChatCompletion(
        {
            model: "gpt-3.5-turbo",
            messages: arrayMessage,
            max_tokens: 2000,
        },
    );


    return chat_completion.data.choices[0].message.content
}

LoadWhats()