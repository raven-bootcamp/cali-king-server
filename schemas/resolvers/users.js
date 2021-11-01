const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { UserInputError } = require("apollo-server");

const { validateRegisterInput, validateLoginInput } = require("../../util/validators")
const { SECRET_KEY } = process.env;
const User = require("../../models/User");

function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            username: user.username,
        }, 
        `${SECRET_KEY}`, 
        { expiresIn: "1h"}
    );
}

module.exports = {
    Mutation: {
        async login(_, { username, password }) {
            const { errors, valid } = validateLoginInput(username, password);
            
            if (!valid) {
                throw new UserInputError("Errors", { errors });
            }

            const user = await User.findOne({ username });

            if (!user) {
                errors.general = "Username not found";
                throw new UserInputError("Cannot find that username", { errors });
            }

            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                errors.general = "Incorrect password";
                throw new UserInputError("Incorrect password", { errors });
            }

            const token = generateToken(user);

            return {
                ...user._doc,
                id: user._id,
                token
            };
        },
        async register(
            _, 
            { 
                registerInput : { username, email, password, confirmPassword }
            } 
         ) {
            // validate user data
            const { valid, errors } = validateRegisterInput(username, email, password, confirmPassword);
            if (!valid) {
                throw new UserInputError("Errors", { errors });
            }

            // make sure user doesn't already exists
            const user = await User.findOne({ username });
            if (user) {
                throw new UserInputError("Username already exists", {
                    errors: {
                        username: "This username already exists"
                    }
                })
            }
            // hash password and create and auth token
            password = await bcrypt.hash(password, 12);
            const newUser = new User({
                email,
                username,
                password,
                createdAt: new Date ().toISOString()
            });

            const res = await newUser.save();

            const token = generateToken(res);

            return {
                ...res._doc,
                id: res._id,
                token
            };
        }
    }
};