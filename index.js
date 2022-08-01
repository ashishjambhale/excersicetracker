const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
 const { Schema } = mongoose;
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/exercise-track', { useNewUrlParser: true }, { useUnifiedTopology: true } )


const personSchema = new Schema({ username: {type: String, unique: true} });
const Person = mongoose.model('Person', personSchema);

const exerciseSchema = new Schema({userId: String, description: String, duration: Number, date: Date})
const Exercise = mongoose.model("Exercise", exerciseSchema)
app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post("/api/users", (req, res) => {

  const newPerson= new Person({username: req.body.username});
  newPerson.save((err, data) => {
    if(err){
      res.json("Username already taken")
    }else{

    res.json({"username": data.username, "_id": data.id })
    }
  })
});

app.post("/api/users/:_id/exercises", (req,res) => {
  let {description, duration, date} = req.body;
 let userId= req.params["_id"];
  console.log(userId,date)
  if(!date){
    date = new Date();
  }

  Person.findById(userId, (err, data) => {
    if(!data){
      res.send("Unknown userId")
    }else{
      const username = data.username;
let newExercise = new Exercise({userId, description, duration, date })
  newExercise.save((err, data) => {
    res.json({username,description, duration: +duration, _id: userId,  date: new Date(date).toDateString()})
  })
    }
  //   username: 'fcc_test_1596648410971', // Obviously the numbers change
  // description: 'test',
  // duration: 60,
  // _id: 5f29cd9e782d5f13d127b456, // Example id
  // date: 'Mon Jan 01 1990'

  })
})

app.get("/api/users/:_id/exercises", (req, res)=>{
  const {userId, from, to, limit} = req.query;
  Person.findById(userId, (err, data) => {
    if(!data){
      res.send("Unknown userId")
    }else{
      const username = data.username;
      console.log({"from": from, "to": to, "limit": limit});
      Exercise.find({userId},{date: {$gte: new Date(from), $lte: new Date(to)}}).select(["id","description", "duration", "date"]).limit(+limit).exec( (err, data) => {
        let customdata = data.map(exer => {
          let dateFormatted = new Date(exer.date).toDateString();
          return {id: exer.id, description: exer.description, duration: exer.duration, date: dateFormatted}
        })
        if(!data){
          res.json({
            "userId": userId,
            "username": username,
            "count": 0,
            "log": []})
        }else{
          res.json({
            "userId": userId,
            "username": username,
            "count": data.length,
            "log": customdata})
        }
      })
      
    }
  })
})


// app.get("/api/users/:_id/logs", (req, res)=>{
//   const { from, to, limit} = req.query;
//   let userId= req.params["_id"];
//   Person.findById(userId, (err, data) => {
//     if(!data){
//       res.send("Unknown userId")
//     }else{
//       const username = data.username;
//       console.log({"from": from, "to": to, "limit": limit});
//       Exercise.find({userId},{date: {$gte: new Date(from), $lte: new Date(to)}}).select(["id","description", "duration", "date"]).limit(+limit).exec( (err, data) => {
//         let customdata = data.map(exer => {
//           let dateFormatted = new Date(exer.date).toDateString();
//           return {id: exer.id, description: exer.description, duration: exer.duration, date: dateFormatted}
//         })
//         if(!data){
//           res.json({
//             "userId": userId,
//             "username": username,
//             "count": 0,
//             "log": []})
//         }else{
//           res.json({
//             "userId": userId,
//             "username": username,
//             "count": data.length,
//             "log": customdata})
//         }
//       })
      
//     }
//   })
// })

app.get("/api/users/:_id/logs", (req, res) => {
  // get user id from params and check that it won't break the DB query
  const { _id } = req.params;
  if (_id.length !== 24) {
    return res.json({ error: "User ID needs to be 24 hex characters" });
  }

  // find the user
  getUserByIdAnd(_id, (userObject) => {
    if (userObject === null) res.json({ error: "User not found" });
    else {
      const limit = req.query.limit ? req.query.limit : 0;

      // /!\ NOTE `limit` is being applied here BEFORE `from` and `to`
      let promise = ExerciseActivity.find({ user_id: _id }).limit(limit).exec();
      assert.ok(promise instanceof Promise);
      promise.then((exerciseObjects) => {
        // /!\ NOTE `limit` has already been applied at this point, so only
        // the truncated array of exercises will be filtered by `from` and `to`
        if (req.query.from) {
          const from = new Date(req.query.from);
          exerciseObjects = exerciseObjects.filter(
            (e) => new Date(e.date).getTime() >= from.getTime()
          );
        }
        if (req.query.to) {
          const to = new Date(req.query.to);
          exerciseObjects = exerciseObjects.filter(
            (e) => new Date(e.date).getTime() <= to.getTime()
          );
        }
        exerciseObjects = exerciseObjects.map((e) => ({
          ...e,
          date: new Date(e.date).toDateString(),
        }));

        res.json({
          _id: userObject._id,
          username: userObject.username,
          count: exerciseObjects.length,
          log: exerciseObjects,
        });
      });
    }
  });
});

app.get("/api/users", (req, res) => {
  Person.find({}, (err, data) => {
    if(!data){
      res.send("No users")
    }else{

    res.json(data)
    }
  })
  
})
// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
