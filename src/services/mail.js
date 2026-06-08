import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass:process.env.GMAIL_PASS,
    }
});


export const sendEmail = async (para, codigo) => {
    await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: para,
        subject: 'Código de recuperação de senha',
        text: `Seu código de recuperação de senha é: ${codigo}`,
    });
};