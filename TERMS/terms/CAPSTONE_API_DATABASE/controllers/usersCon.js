import {v4 as uuidv4} from 'uuid';

let users = [];

export const createUser = (req, res) => {
  const user = req.body;
  users.push({ ...user, id: uuidv4() });
  res.send(`User with the name ${user.name} added to the database`);
};

export const getUser = (req, res) => {
  const { id } = req.params;
  const foundUser = users.find(user => user.id === id);
  res.send(foundUser);
};

export const deleteUser = (req, res) => {
  const { id } = req.params;
  users = users.filter(user => user.id !== id);
  res.send(`User with the id ${id} deleted from the database`);
};

export const getUsers = (req, res) => { 
  res.send(users);
};

export const patchUser = (req, res) => {
  const { id } = req.params;
  const { username, password, name, role } = req.body;
  const user = users.find(user => user.id === id);
  if (!user) {
    return res.status(404).send('User not found');
  }
  if (username) user.username = username;
  if (password) user.password = password;
  if (name) user.name = name;
  if (role) user.role = role;
  res.send(`User with the id ${id} has been updated`);
};