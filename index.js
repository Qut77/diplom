const express = require("express");
const path = require("path");
const port = 3000;
const app = express();
const { Sequelize, Model, DataTypes } = require('sequelize');
const session = require('express-session');
const fs = require('fs').promises;
const { Document, Paragraph, TextRun, Packer, AlignmentType, BorderStyle } = require('docx');
const nodemailer = require('nodemailer');
const xss = require('xss');
require('dotenv').config();


app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); 

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET, // Секрет теперь берётся из переменных окружения
    resave: false,
    saveUninitialized: false
}));

const multer = require('multer');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public', 'image'));
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Разрешены только файлы JPEG, PNG и GIF'), false);
        }
    }
});

const sequelize = new Sequelize('osis', 'postgres', '277353', {
    host: 'localhost',
    dialect: 'postgres',
});

const Connection = async () => {
    try {
        await sequelize.authenticate();
        console.log('Соединение с базой данных успешно установлено.');
    } catch (error) {
        console.error('Не удалось подключиться к базе данных:', error);
    }
};
Connection();

class Role extends Model {}
Role.init({
    role_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    role: {
        type: DataTypes.STRING(50),
        allowNull: false,
    }
}, {
    sequelize,
    modelName: 'Role',
    tableName: 'role',
    timestamps: false,
});

class Users extends Model {}
Users.init({
    user_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    role_id: {
        type: DataTypes.INTEGER,
        references: {
            model: Role,
            key: 'role_id'
        },
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    first_name: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    last_name: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    phone: {
        type: DataTypes.STRING(20),
    }
}, {
    sequelize,
    modelName: 'Users',
    tableName: 'users',
    timestamps: false,
});

class Orders extends Model {}
Orders.init({
    order_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    user_id: {
        type: DataTypes.INTEGER,
        references: {
            model: Users,
            key: 'user_id'
        },
        allowNull: false,
    },
    order_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
    },
    type: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    information: {
        type: DataTypes.TEXT,
    },
    status: {
        type: DataTypes.STRING(50),
        allowNull: false,
    }
}, {
    sequelize,
    modelName: 'Orders',
    tableName: 'orders',
    timestamps: false,
});

class Reviews extends Model {}
Reviews.init({
    review_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    user_id: {
        type: DataTypes.INTEGER,
        references: {
            model: Users,
            key: 'user_id'
        },
        allowNull: false,
    },
    text: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING(50),
        allowNull: false,
    }
}, {
    sequelize,
    modelName: 'Reviews',
    tableName: 'reviews',
    timestamps: false,
});

class News extends Model {}
News.init({
    news_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    image: {
        type: DataTypes.TEXT,
    },
    header: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    text: {
        type: DataTypes.TEXT,
        allowNull: false,
    }
}, {
    sequelize,
    modelName: 'News',
    tableName: 'news',
    timestamps: false,
});

class Projects extends Model {}
Projects.init({
    project_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    region: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    text: {
        type: DataTypes.TEXT,
        allowNull: false,
    }
}, {
    sequelize,
    modelName: 'Projects',
    tableName: 'projects',
    timestamps: false,
});

// Определение связей между моделями
Role.hasMany(Users, { foreignKey: 'role_id' });
Users.belongsTo(Role, { foreignKey: 'role_id' });

Users.hasMany(Orders, { foreignKey: 'user_id' });
Orders.belongsTo(Users, { foreignKey: 'user_id' });

Users.hasMany(Reviews, { foreignKey: 'user_id' });
Reviews.belongsTo(Users, { foreignKey: 'user_id' });


sequelize.sync()
    .then(() => {
        console.log('База данных и таблицы созданы!');
    })
    .catch(error => {
        console.error('Ошибка при синхронизации:', error);
    });
    

function isAuthenticated(req, res, next){
    if (req.session.user) {
        next();
    } else {
        res.redirect('/avtor');
    }
}

function hasRole(roleName){
    return async (req, res, next) => {
        if (req.session.user) {
            const user = await Users.findByPk(req.session.user.id, { include: Role });
            
            if (user && user.Role.role === roleName) {
                next();
            } else {
                console.log('User  ID from session:', req.session.user.id);
                console.log('Fetched user:', user);
                res.status(403).send('Доступ запрещен');
                
            }
        } else {
            res.redirect('/avtor');
        }
    };
}

app.get('/', async (req, res) => {
    try {
        const news = await News.findAll({ 
            limit: 3,
            order: [['news_id', 'DESC']] 
        });
        
        const reviews = await Reviews.findAll({
            where: {
                status: 'confirmed'
            },
            include: [{
                model: Users,
                attributes: ['first_name', 'last_name'],
            }],
        });
        
        const projects = await Projects.findAll();

        res.render('index', { 
            news,
            projects,
            reviews,
            firstNews: news[0],  
            secondNews: news[1], 
            thirdNews: news[2]  
        });
    } catch (error) {
        console.error('Ошибка при получении данных:', error);
        res.status(500).send('Ошибка сервера');
    }
});

app.get('/avtor', (req, res) => {
    if (req.session.user) {
        res.redirect('/profile');
    } else{
        res.redirect('login.html')
    }
});

app.post('/register', async (req, res) => {
    const { email, password, first_name, last_name, phone, rep_password } = req.body;
    const role_id  = 2;
    if (password != rep_password) {
        res.status(400).send('<script>alert("Пароли должны совпадать."); window.location.href = "regist.html";</script>');
    };
    if (phone.length > 11) {
        res.status(400).send('<script>alert("Номер телефона не должен превышать 11 символов."); window.location.href = "regist.html";</script>');
    };
    const existingUser  = await Users.findOne({ where: { email } });
    if (existingUser ) {
        res.status(400).send('<script>alert("Пользователь с таким email уже зарегистрирован."); window.location.href = "regist.html";</script>');
    }
    const user = await Users.create({ email, password, role_id, first_name, last_name, phone});
    res.redirect('login.html');
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await Users.findOne({ where: { email, password }, include:Role });
    if (user) {
        req.session.user = { id: user.user_id, login: user.email, role: user.Role.role };
        res.redirect('/profile');
    } else {
    res.status(401).send('<script>alert("Неверный логин или пароль."); window.location.href = "login.html";</script>');
    }
});

app.get('/profile', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    const user = await Users.findOne({ where: { user_id: userId }, include: Role });
    res.render('lk', { user });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        res.redirect('login.html');
    });
});

app.get('/edit/:id', async (req, res) => { 
    const userId = req.params.id; 
    const user = await Users.findByPk(userId, { include: Role });
    res.render('edit', { user }); 
});

app.post('/edit-user/:id', async (req, res) => {
    const userId = req.params.id; 
    const { email, first_name, last_name, phone } = req.body; 
    await Users.update(
        { email, first_name, last_name, phone }, 
        { where: { user_id: userId } } 
    );  
    res.redirect('/profile');
});

app.post('/review', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).send('<script>alert("Вы не авторизованы."); window.location.href = "/avtor";</script>');
        }
        const { review } = req.body;
        const userId = req.session.user.id;
        
        const userReviewsCount = await Reviews.count({ where: { user_id: userId } });

        if (userReviewsCount >= 3) {
            return res.status(400).send('<script>alert("Вы не можете оставить более 3 отзывов."); window.location.href = "/#review";</script>');
        }

        await Reviews.create({ user_id: userId, text: review, status: 'not confirmed' });
        res.redirect('/#review');

    } catch (error) {
        console.error('Ошибка при обработке отзыва:', error);
        res.status(401).send('<script>alert("Что-то пошло не так."); window.location.href = "/#review";</script>');
    }
});
function getStatusColor(status) {
    const statusColors = {
        'completed': '2E7D32',
        'pending': 'FF8F00',
        'rejected': 'C62828',
        'in_progress': '1565C0'
    };
    return statusColors[status] || '444444';
}

async function generateOrderDocument(order, user, type, cleanInformation) {
    const doc = new Document({
        sections: [{
            properties: {
                page: {
                    margin: {
                        top: 1000,
                        right: 1000,
                        bottom: 1000,
                        left: 1000
                    }
                }
            },
            children: [
                // Заголовок письма
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Информация о заявке",
                            bold: true,
                            size: 28,
                            color: "2A54C4",
                            font: "Calibri"
                        })
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400, line: 300 },
                    border: {
                        bottom: {
                            color: "2A54C4",
                            space: 10,
                            style: BorderStyle.SINGLE,
                            size: 8
                        }
                    }
                }),

                // Блок информации о заявке
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Детали заявки",
                            bold: true,
                            size: 22,
                            color: "444444",
                            font: "Calibri"
                        })
                    ],
                    spacing: { before: 200, after: 150 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `ID заявки: ${order.order_id}`,
                            bold: true,
                            size: 20
                        })
                    ],
                    indent: { left: 500 },
                    spacing: { after: 100 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Тип заявки: ${type}`,
                            size: 20
                        })
                    ],
                    indent: { left: 500 },
                    spacing: { after: 100 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Статус: `,
                            size: 20
                        }),
                        new TextRun({
                            text: `${order.status}`,
                            color: getStatusColor(order.status), // Функция для цвета статуса
                            bold: true,
                            size: 20
                        })
                    ],
                    indent: { left: 500 },
                    spacing: { after: 200 }
                }),

                // Блок информации о пользователе
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Информация о пользователе",
                            bold: true,
                            size: 22,
                            color: "444444",
                            font: "Calibri"
                        })
                    ],
                    spacing: { before: 400, after: 150 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `ID пользователя: ${user.user_id}`,
                            size: 20
                        })
                    ],
                    indent: { left: 500 },
                    spacing: { after: 100 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Фамилия имя: ${user.last_name} ${user.first_name}`,
                            size: 20
                        })
                    ],
                    indent: { left: 500 },
                    spacing: { after: 100 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Контакты: `,
                            size: 20
                        }),
                        new TextRun({
                            text: `${user.email}`,
                            color: "2A54C4",
                            size: 20
                        }),
                        new TextRun({
                            text: ", ",
                            size: 20
                        }),
                        new TextRun({
                            text: `${user.phone}`,
                            color: "2A54C4",
                            size: 20
                        })
                    ],
                    indent: { left: 500 },
                    spacing: { after: 200 }
                }),

                // Блок дополнительной информации
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Дополнительная информация",
                            bold: true,
                            size: 22,
                            color: "444444",
                            font: "Calibri"
                        })
                    ],
                    spacing: { before: 400, after: 150 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: cleanInformation,
                            size: 20
                        })
                    ],
                    indent: { left: 500, hanging: 300 },
                    spacing: { after: 400 }
                }),

                // Подпись
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "С уважением,",
                            size: 20,
                            italics: true
                        })
                    ],
                    spacing: { before: 300 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Команда поддержки",
                            size: 20,
                            color: "2A54C4",
                            bold: true
                        })
                    ]
                })
            ]
        }]
    });
    return Packer.toBuffer(doc);
};
const emailService = {
  transporter: nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: true,
    auth: {
      user: 'plovhaha@gmail.com',
      pass: 'Kirill277353'
    }
  }),

  // Универсальная отправка
  async sendEmail(mailOptions) {
    await this.transporter.sendMail(mailOptions);
  },

  // Формирование письма о заявке
  createOrderNotification(order, user, documentBuffer) {
    return {
      from: 'plovhaha@gmail.com',
      to: 'olegaboba277@gmail.com',
      subject: `Новая заявка #${order.order_id}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; }
            .header { background-color: #f8f8f8; padding: 15px; border-radius: 5px 5px 0 0; text-align: center; }
            .content { padding: 20px; }
            .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #777; }
            .order-id { font-weight: bold; color: #2c3e50; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Новая заявка</h2>
            </div>
            <div class="content">
              <p>Поступила новая заявка от клиента:</p>
              <p><strong>Имя:</strong> ${user.last_name} ${user.first_name}</p>
              <p><strong>Номер заявки:</strong> <span class="order-id">#${order.order_id}</span></p>
              <p>Детали заявки прикреплены в виде файла.</p>
            </div>
            <div class="footer">
              <p>Это автоматическое сообщение, пожалуйста, не отвечайте на него.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Новая заявка #${order.order_id} от ${user.last_name} ${user.first_name}. Детали во вложении.`,
      attachments: [{
        filename: `Заявка_${order.order_id}.docx`,
        content: documentBuffer
      }]
    };
  }
};

app.post('/order', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).send('<script>alert("Для оформления заявки необходимо авторизоваться."); window.location.href = "/avtor";</script>');
        }
        const { type, information } = req.body;
        const cleanInformation = xss(information);
        const userId = req.session.user.id;
        // Находим пользователя в базе данных
        const user = await Users.findByPk(userId);
        if (!user) {
            return res.status(404).send('<script>alert("Пользователь не найден."); window.location.href = "/";</script>');
        }
        // Создаем заявку
        const order = await Orders.create({
            user_id: userId,
            type: type,
            information: cleanInformation,
            status: 'pending'
        });
        const docBuffer = await generateOrderDocument(order, user, type, cleanInformation);
        const mailOptions = emailService.createOrderNotification(order, user, docBuffer);
        await emailService.sendEmail(mailOptions);
        res.send('<script>alert("Ваша заявка успешно отправлена!"); window.location.href = "/";</script>');
    } catch (error) {
        console.error('Ошибка при обработке заявки:', error);
        res.status(500).send('<script>alert("Произошла ошибка при отправке заявки."); window.location.href = "/";</script>');
    }
});

app.get('/admin', isAuthenticated, hasRole('admin'), async (req, res) => {
    const news = await News.findAll();
    const projects = await Projects.findAll();
    const users = await Users.findAll({
        include: [{
            model: Role,
            attributes: ['role']
        }]
    });
    const orders = await Orders.findAll({
        include: [ {
            model: Users,
            attributes: ['first_name', 'last_name', 'email', 'phone']
        }]
    });
    const reviews = await Reviews.findAll({
        include: [ {
            model: Users,
            attributes: ['first_name', 'last_name', 'email', 'phone']
        }]
    });
    res.render('admin', { news, users, projects, orders, reviews});
});


app.post('/admin/edit-order/:order_id', async (req, res) => {
    try {
        const order_id = req.params.order_id;
        const { status } = req.body;
        
        await Orders.update(
            { status: status },
            { where: { order_id: order_id } }
        );
        
        res.redirect('/admin');
    } catch (error) {
        console.error('Ошибка при изменении статуса заказа:', error);
        res.status(500).send('Ошибка сервера');
    }
});

app.get('/admin/del-order/:order_id', async (req, res) => {
    try {
        const order_id = req.params.order_id;
        
        await Orders.destroy({
            where: { order_id: order_id }
        });
        
        res.redirect('/admin');
    } catch (error) {
        console.error('Ошибка при удалении заказа:', error);
        res.status(500).send('Ошибка сервера');
    }
});

app.get('/admin/del-news/:news_id', async (req, res) => {
    try {
        const news_id = req.params.news_id;

        const news = await News.findOne({
            where: { news_id: news_id }
        });

        if (!news) {
            return res.status(404).send('Новость не найдена');
        }

        if (news.image) {
            const imagePath = path.join(__dirname, 'public', 'image', news.image);
            
            try {
                await fs.unlink(imagePath);
            } catch (fsError) {
                console.error('Ошибка при удалении файла:', fsError);
            }
        }

        await News.destroy({
            where: { news_id: news_id }
        });
        
        res.redirect('/admin');
    } catch (error) {
        console.error('Ошибка при удалении новости:', error);
        res.status(500).send('Ошибка сервера');
    }
});

app.get('/admin/del-projects/:project_id', async (req, res) => {
    try {
        const project_id = req.params.project_id;
        
        await Projects.destroy({
            where: { project_id: project_id }
        });
        
        res.redirect('/admin');
    } catch (error) {
        console.error('Ошибка при удалении проекта:', error);
        res.status(500).send('Ошибка сервера');
    }
});
app.get('/admin/del-users/:user_id', async (req, res) => {
    try {
        const user_id = req.params.user_id;
        
        await Users.destroy({
            where: { user_id: user_id }
        });
        
        res.redirect('/admin');
    } catch (error) {
        console.error('Ошибка при удалении пользователя:', error);
        res.status(500).send('Ошибка сервера');
    }
});
app.post('/admin/create-news', upload.single('image'), async (req, res) => {
    try {
        const { title, content } = req.body;
        const image = req.file;
        if (!image) {
            return res.status(400).send('Необходимые файлы не были загружены');
        }
        await News.create({
            image: image.filename,
            header: title,
            text: content,
        });

        res.status(200).send('Новость успешно создана');
    } catch (error) {
        console.error('Ошибка при создании новости:', error);
        res.status(500).send('Ошибка сервера');
    }
});
app.post('/admin/create-project', upload.single('image'), async (req, res) => {
    try {
        const { region, name, text } = req.body;
        await Projects.create({
            region,
            name,
            text,
        });

        res.status(200).send('Проект успешно создан');
    } catch (error) {
        console.error('Ошибка при создании проекта:', error);
        res.status(500).send('Ошибка сервера');
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
