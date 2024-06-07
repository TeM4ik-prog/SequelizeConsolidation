const express = require('express');
const { Sequelize, DataTypes, JSON, where } = require('sequelize');
const { importantCategories } = require('./data');


//config

const sequelize = new Sequelize('nodejs', 'artem', 'artem', {
    host: 'localhost',
    dialect: 'mssql',
    logging: false
});

//



const app = express();
const port = 3000;

const User = sequelize.define('User', {
    username: {
        type: DataTypes.STRING,
        unique: true
    },
    password: DataTypes.STRING,
    money: DataTypes.INTEGER,
});


const Category = sequelize.define('Category', {
    categoryId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    }
});

const Product = sequelize.define('Product', {
    productId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: DataTypes.STRING,
    price: DataTypes.INTEGER
});

const Basket = sequelize.define('Basket', {});

async function OnCreateCategories() {
    for (const categoryName of importantCategories) {
        await Category.findOrCreate({ where: { name: categoryName } });

    }
}




User.belongsToMany(Product, { through: 'Basket' });
Product.belongsToMany(User, { through: 'Basket' });

Category.hasMany(Product);
Product.belongsTo(Category);

OnCreateCategories()

function validatePassword(user, password) {
    return user.password === password;
}

app.use(express.static("./public"))
app.use(async (req, res, next) => {
    try {

        //для очистки бд
        // await sequelize.sync({ force: true });
        await sequelize.authenticate();

        console.log('База данных синхронизирована');
        next();
    } catch (error) {
        console.error('Ошибка при синхронизации базы данных:', error);
        res.status(500).send('Ошибка при синхронизации базы данных');
    }


})



// app.get("/", async (req, res) => {
//     try {
//         await sequelize.authenticate();
//         console.log('Соединение с БД было успешно установлено');
//     } catch (error) {
//         console.error('Невозможно выполнить подключение к БД:', error);
//     }
//     res.end();
// });

app.get("/addUser", async (req, res) => {
    let { username, password, money } = req.query;

    try {
        await User.create({ username, password, money });
        res.status(200).json({ massage: `пользователь ${username} добавлен` });

    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            res.status(400).json({ message: "Пользователь с таким именем уже существует" });
        } else {
            console.error('Ошибка при создании пользователя:', error);
            res.status(500).send('Ошибка при создании пользователя \n' + error);
        }

    }
});


app.get("/addProd", async (req, res) => {
    let { name, price, categoryId } = req.query;
    price = parseInt(price)

    console.log(categoryId)

    try {
        let product = await Product.create({ name, price });


        let category = false;
        if (categoryId) {
            categoryId = parseInt(categoryId);

            if (!isNaN(categoryId)) {
                category = await Category.findByPk(categoryId);
            }
        }


        console.log(category)
        if (!category) {
            console.log("uncategorized")
            const [uncategorized, created] = await Category.findOrCreate({ where: { name: "uncategorized" } });
            category = uncategorized;
        }

        // console.log(category)
        await product.setCategory(category);

        res.status(200).json({ massage: `продукт ${name} добавлен в категорию ${category.name}` });

    } catch (error) {
        res.status(500).send('Ошибка при создании пользователя \n' + error);
    }
});

app.get("/userEnt", async (req, res) => {
    let { username, password } = req.query

    try {
        let userFind = await User.findOne({ where: { username } })

        if (userFind.password == password) {
            res.status(200).send("<h1>Вы вошли</h1>")
        }
        else {
            res.status(400).json({ massage: "Неправильный пароль" })
        }

    } catch (error) {
        res.status(400).json({ massage: "Произошла неизвестная ошибка" })

    }

    // if (!userFind) return res.status(400).json({ massage: "Такого пользователя нет" })

})

app.get("/findUser", async (req, res) => {
    let { username } = req.query
    const user = await User.findOne({ where: { username } });


    res.send(user)
})

app.get("/allUsers", async (req, res) => {
    res.json(await User.findAll());
})

app.get("/allProds", async (req, res) => {
    res.json(await Product.findAll());
})

app.get("/categories", async (req, res) => {
    res.json(await Category.findAll())
})


app.get("/category", async (req, res) => {
    let { categoryId } = req.query;

    try {
        const category = await Category.findByPk(categoryId);

        if (!category) {
            return res.status(404).json({ message: "Категория не найдена" });
        }

        const products = await category.getProducts();

        res.status(200).json(products);
    } catch (error) {
        console.error('Ошибка при получении продуктов по категории:', error);
        res.status(500).json({ message: "Ошибка при получении продуктов по категории " + error });
    }
});





app.get("/addToBasket", async (req, res) => {

    let { username, ProductId } = req.query

    console.log(username, ProductId)

    try {
        const user = await User.findOne({ where: { username: username } });
        if (!user) {
            return res.status(404).json({ message: "Пользователь не найден" });
        }

        const product = await Product.findByPk(ProductId);

        console.log(ProductId)
        console.log(user.id)
        // console.log({ UserId: Number(user.id), ProductId: Number(ProductId) })
        if (!product) {
            return res.status(404).json({ message: "Товар не найден" });
        }

        await user.addProduct(product)

        res.status(200).json({ message: "Товар успешно добавлен в корзину пользователя" });
    } catch (error) {
        console.error('Ошибка при добавлении товара в корзину: ' + error);
        res.status(500).json({ message: ` Ошибка при добавлении товара в корзину ${error} ` });
    }


})

app.get("/basket", async (req, res) => {
    const { username } = req.query;

    try {
        const user = await User.findOne({ where: { username: username } });

        if (!user) {
            return res.status(404).json({ message: "Пользователь не найден" });
        }

        const basket = await user.getProducts()

        res.status(200).json(basket);
    } catch (error) {
        console.error('Ошибка при получении корзины пользователя:', error);
        res.status(500).json({ message: "Ошибка при получении корзины пользователя " + error });
    }

})



app.get("/deleteCategory", async (req, res) => {
    let { categoryId } = req.query

    try {
        const category = await Category.findByPk(categoryId);

        if (!category) {
            return res.status(404).json({ message: "Категория не найдена" });
        }

        const [uncategorizedCategory, created] = await Category.findOrCreate({ where: { name: "uncategorized" } });


        if (category.categoryId === uncategorizedCategory.categoryId) {
            return res.status(400).json({ message: "Категорию 'без категории' нельзя удалить" });
        }

        const products = await category.getProducts();
        for (const product of products) {
            await product.setCategory(uncategorizedCategory);
        }

        await category.destroy();

        res.status(200).json({ message: "Категория удалена, продукты перенесены в категорию 'без категории'" });
    } catch (error) {
        console.error('Ошибка при удалении категории:', error);
        res.status(500).json({ message: "Ошибка при удалении категории " + error });
    }

})





app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});