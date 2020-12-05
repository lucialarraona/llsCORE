
const Sequelize = require("sequelize");
const {models} = require("../models");

// Autoload el group asociado a :groupId
exports.load = async (req, res, next, groupId) => {

    try {
        const group = await models.Group.findByPk(groupId);
        if (group) {
            req.load = {...req.load, group}; //busqueda ansiosa para guardar en req.load los grupos con el id de la ruta 
            next();
        } else {
            throw new Error('There is no quiz with id=' + groupId);
        }
    } catch (error) {
        next(error);
    }
};

// GET /groups
exports.index = async (req, res, next) => {

try {
        const groups = await models.Group.findAll();
        res.render('groups/index.ejs', {groups});
    } catch (error) {
        next(error);
    }
};

// GET /groups/new
exports.new = async (req, res, next) => {

    const group = {name: ""};
    res.render('groups/new', {group});
};



// POST /groups/create
exports.create = async (req, res, next) => {

    const {name} = req.body;

    let group = models.Group.build({name});

    try {
        // Saves only the fields question and answer into the DDBB
        group = await group.save();
        req.flash('success', 'Group created successfully.');
        res.redirect('/groups');
    } catch (error) {
        if (error instanceof Sequelize.ValidationError) {
            req.flash('error', 'There are errors in the form:');
            error.errors.forEach(({message}) => req.flash('error', message));
            res.render('groups/new', {group});
        } else {
            req.flash('error', 'Error creating a new Group: ' + error.message);
            next(error);
        }
    }
};

// GET /groups/:groupId/edit
exports.edit = async (req, res, next) => {

    const {group} = req.load; // sacamos de req.load el atributo "grupo" que se habia precargado

    const allQuizzes = await models.Quiz.findAll(); // array con todos los quizzes de la bbdd
    const groupQuizzesIds = await group.getQuizzes().map(quiz => quiz.id); // getQuizzes se genera automaticamente, 
                                                                        // map sirve para que te de el id del quiz, por tanto te devuelve un array de ids!!!
    res.render('groups/edit', {group,allQuizzes,groupQuizzesIds}); //le pasamos todos los parametros a la vista
};

// PUT /groups/:groupId

exports.update = async (req, res, next) => {

   const {group} = req.load; //Guardamos el grupo que sacamos de la variable req.load

    const {name, quizzesIds = []} = req.body; //guardamos el nombre del grupo y los ids de los quizzes que tiene asociados de la variable body

    group.name = name.trim(); // nuevo nombre del grupo


    try {
        await group.save({fields: ["name"]}); // guardamos ese  valor en la base de datos
        await group.setQuizzes(quizzesIds); // le asigno los quizzes que quiero
        req.flash('success', 'Group edited successfully.');
        res.redirect('/groups');
    } catch (error) {
        if (error instanceof Sequelize.ValidationError) {
            req.flash('error', 'There are errors in the form:');
            error.errors.forEach(({message}) => req.flash('error', message));

            const allQuizzes = await models.Quiz.findAll();

            res.render('groups/edit', {group, allQuizzes, groupQuizzesIds: quizzesIds});
        } else {
            req.flash('error', 'Error editing the Groups: ' + error.message);
            next(error);
        }
    }
};

// DELETE /groups/:groupId
exports.destroy = async (req, res, next) => {

    try {
        await req.load.group.destroy();
        req.flash('success', 'Group deleted successfully.');
        res.redirect('/goback');
    } catch (error) {
        req.flash('error', 'Error deleting the Group: ' + error.message);
        next(error);
    }
};

// GET/ groups/groupId/randomPlay
exports.randomPlay = async (req,res,next)  => {

    const group = req.load.group;

    req.session.groupPlay= req.session.groupPlay || {};
    req.session.groupPlay[group.id]= req.session.groupPlay[group.id] || {resolved : [], lastQuizId: 0};
    

    let quiz;

    if (req.session.groupPlay[group.id].lastQuizId) {
        quiz = await models.Quiz.findByPk(req.session.groupPlay[group.id].lastQuizId);

    }else {
    
        const total = await group.countQuizzes();
        const quedan = total - req.session.groupPlay[group.id].resolved.length;
    
        quiz = await models.Quiz.findOne({
            where: {'id': {[Sequelize.Op.notIn]: req.session.groupPlay[group.id].resolved}}, // que no este en el array de resueltos
            include: [
                {
                    model: models.Group, // y que pertenezca al grupo en el que estoy jugando
                    as: "groups",
                    where: {id:group.id}
                }
            ],
            offset: Math.floor(Math.random() * quedan)
        });
    }
    const score = req.session.groupPlay[group.id].resolved.length;

    if(quiz){
        req.session.groupPlay[group.id].lastQuizId = quiz.id;
        res.render("groups/random_play", {group, quiz,score})
    }else {
        delete req.session.groupPlay[group.id];
        res.render("groups/random_nomore", {group, score})
    }

};

//GET /groups/groupId/randomcheck/:quizzId

exports.randomCheck = async (req,res,next)  => {

    const group = req.load.group;

    req.session.groupPlay= req.session.groupPlay || {};
    req.session.groupPlay[group.id]= req.session.groupPlay[group.id] || {resolved : [], lastQuizId: 0};

    const answer = req.query.answer || "";

    const result = answer.toLowerCase().trim() === req.load.quiz.answer.toLowerCase().trim(); 

    if (result){

        req.session.groupPlay[group.id].lastQuizId = 0; 

        if (req.session.groupPlay[group.id].resolved.indexOf(req.load.quiz.id) == -1){
            req.session.groupPlay[group.id].resolved.push(req.load.quiz.id);
        }
        
        const score = req.session.groupPlay[group.id].resolved.length;

        res.render("groups/random_result", { group, result,answer,score})

    } else {

        const score = req.session.groupPlay[group.id].resolved.length;
        delete req.session.groupPlay[group.id];

        res.render("groups/random_result", { group, result,answer,score})

    }

};

