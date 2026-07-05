import Joi from 'joi';

export const registerSchema = Joi.object({
  username: Joi.string().min(3).max(30).required(),
  password: Joi.string().min(6).required(),
  display_name: Joi.string().min(1).max(50).required(),
  wallet_address: Joi.string().allow(null, ''),
  public_key: Joi.string().required(),
});

export const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});
