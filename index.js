// const puppeteer = require('puppeteer');
const { sleep } = require('./sleep.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('ready', async () => {
    console.log('Client is ready!');
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

let agendamentos = {}; // Objeto para armazenar agendamentos por usuário
let msgID = null;
let aguardandoHorario = false;
let descricao = null;

client.on('message_create', async message => {
    if (message.body.toLowerCase() === 'agendar' && !message.fromMe) {
        msgID = message.from;
        aguardandoHorario = false;
        descricao = null;

        await client.sendMessage(message.from, 'Está querendo agendar para lembrar algo? Digite um título para o agendamento:');
    } else if (msgID && msgID === message.from && !message.fromMe && !aguardandoHorario && message.body) {
        console.log('Guardando título do agendamento...');
        descricao = message.body;

        await client.sendMessage(message.from, `Título salvo: *${descricao}*`);

        await sleep(2000);

        await client.sendMessage(message.from, 'Agora me diga o horário no formato: *HH:MM*.');
        aguardandoHorario = true;
    } else if (msgID && msgID === message.from && !message.fromMe && aguardandoHorario) {
        const hrRegex = /^\d{2}:\d{2}$/;

        if (hrRegex.test(message.body)) {
            const horario = message.body;
            const [hora, minuto] = horario.split(':').map(Number);

            const agendamento = {
                titulo: descricao,
                horario: new Date()
            };
            agendamento.horario.setHours(hora, minuto, 0, 0);

            if (!agendamentos[msgID]) {
                agendamentos[msgID] = [];
            }

            agendamentos[msgID].push(agendamento);

            await client.sendMessage(message.from, `Horário salvo: *${horario}*.`);
            await sleep(1000);
            await client.sendMessage(message.from, 'Agendamento completo. _Para ver sua lista de agendamentos, digite "Ver Agendamentos"_.');

            // Resetar variáveis
            msgID = null;
            aguardandoHorario = false;
            descricao = null;

        } else {
            await client.sendMessage(message.from, 'Formato de horário inválido. Por favor, use o formato *HH:MM*.');
        }
    } else if (message.body.toLowerCase() === 'ver agendamentos' && !message.fromMe) {
        const agendamentosUsuario = agendamentos[message.from];

        if (agendamentosUsuario && agendamentosUsuario.length > 0) {
            let resposta = 'Seus agendamentos:\n\n';
            agendamentosUsuario.forEach((agendamento, index) => {
                resposta += `${index + 1}. *${agendamento.titulo}* às ${agendamento.horario.toLocaleTimeString()}\n`;
            });

            await client.sendMessage(message.from, resposta);
        } else {
            await client.sendMessage(message.from, 'Você não tem nenhum agendamento.');
        }
    }
});

// Função para verificar os agendamentos periodicamente
setInterval(() => {
    const now = new Date();

    Object.keys(agendamentos).forEach(userID => {
        agendamentos[userID].forEach((agendamento, index) => {
            if (now >= agendamento.horario) {
                client.sendMessage(userID, `Lembrete: *${agendamento.titulo}* agora!`);
                agendamentos[userID].splice(index, 1); // Remove o agendamento após a notificação
            }
        });
    });
}, 30000); // Verifica a meio minuto

client.initialize();