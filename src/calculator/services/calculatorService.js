import nodemailer from 'nodemailer';

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const translateValues = {
  projectType: {
    landing: 'Лендинг',
    corporate: 'Корпоративный сайт',
    ecommerce: 'Интернет-магазин',
    webapp: 'Веб-приложение'
  },
  goals: {
    leads: 'Лиды/заявки',
    sales: 'Онлайн-продажи',
    branding: 'Презентация бренда',
    automation: 'Автоматизация процессов'
  },
  designApproach: {
    hasDesign: 'Есть референс/дизайн',
    needDesign: 'Нужна разработка дизайна'
  },
  features: {
    admin: 'Админ-панель',
    cabinet: 'Личный кабинет',
    filters: 'Фильтры/поиск',
    multilang: 'Мультиязычность',
    blog: 'Блог/CMS',
    payment: 'Online Оплата',
    notifications: 'Telegram/email уведомления',
    seo: 'SEO'
  },
  content: {
    ready: 'Контент готов',
    needText: 'Нужна помощь с текстами',
    needVisual: 'Нужна помощь с визуалом'
  }
};

export const sendCalculatorEmail = async (data) => {
  const transporter = createTransporter();
  await transporter.verify();

  const projectTypeText = translateValues.projectType[data.projectType] || data.projectType;
  const goalsText = (data.goals || []).map(g => translateValues.goals[g] || g).join(', ');
  const designApproachText = translateValues.designApproach[data.designApproach] || data.designApproach;
  const featuresText = (data.features || []).map(f => translateValues.features[f] || f).join(', ');
  const contentText = translateValues.content[data.content] || data.content;

  const emailContent = `
    Новый запрос из калькулятора
    
    Контактная информация:
    Имя: ${data.name}
    ${data.contactMethod || 'Контакт'}: ${data.contact}
    ${data.message ? `Сообщение: ${data.message}\n` : ''}
    
    Параметры проекта:
    Тип проекта: ${projectTypeText}
    Цели проекта: ${goalsText || 'Не указано'}
    Дизайн: ${designApproachText}
    Функционал: ${featuresText || 'Не указано'}
    Контент: ${contentText}
    
    Отправлено: ${data.submitted_at}
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: `Калькулятор: ${data.name} - ${projectTypeText}`,
    text: emailContent,
    html: `
      <h2>Новый запрос из калькулятора</h2>
      
      <h3>Контактная информация:</h3>
      <p><strong>Имя:</strong> ${data.name}</p>
      <p><strong>${data.contactMethod || 'Контакт'}:</strong> ${data.contact}</p>
      ${data.message ? `<p><strong>Сообщение:</strong> ${data.message}</p>` : ''}
      
      <h3>Параметры проекта:</h3>
      <p><strong>Тип проекта:</strong> ${projectTypeText}</p>
      <p><strong>Цели проекта:</strong> ${goalsText || '<em>Не указано</em>'}</p>
      <p><strong>Дизайн:</strong> ${designApproachText}</p>
      <p><strong>Функционал:</strong> ${featuresText || '<em>Не указано</em>'}</p>
      <p><strong>Контент:</strong> ${contentText}</p>
      
      <p><em>Отправлено: ${data.submitted_at}</em></p>
    `
  });
};
