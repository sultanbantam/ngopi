import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { prisma } from '../utils/prisma';
import { registerSchema, loginSchema } from '../utils/validation';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';
const BAMBOOCHAIN_CLIENT_ID = process.env.BAMBOOCHAIN_CLIENT_ID || 'client_4e0f61e19c1855c5';
const BAMBOOCHAIN_CLIENT_SECRET = process.env.BAMBOOCHAIN_CLIENT_SECRET || 'secret_bamboochain_123';
const BAMBOOCHAIN_OAUTH_URL = 'https://bamboochain.id/#/authorize';
const BAMBOOCHAIN_TOKEN_URL = 'https://bamboochain.id/api/oauth/token';
const REDIRECT_URI = 'https://api.bamboochat.click/api/auth/bamboochain/callback';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0]?.message });
      return;
    }

    const { username, password, display_name, wallet_address, public_key } = value;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user in DB
    const newUser = await prisma.user.create({
      data: {
        username,
        password_hash,
        display_name,
        wallet_address,
        public_key,
      },
    });

    // Generate JWT
    const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, {
      expiresIn: '7d',
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: newUser.id,
        username: newUser.username,
        display_name: newUser.display_name,
        bmc_id: newUser.bmc_id,
      },
      token, // Also return in JSON for mobile app usage
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0]?.message });
      return;
    }

    const { username, password } = value;

    // Find user
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: '7d',
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        bmc_id: user.bmc_id,
      },
      token, // Also return in JSON for mobile app usage
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        display_name: true,
        wallet_address: true,
        avatar_url: true,
        bio: true,
        status: true,
        bmc_id: true,
      }
    });
    res.status(200).json(users);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { display_name, wallet_address, avatar_url, bio, status } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const updateData: any = {};
    if (display_name !== undefined) updateData.display_name = display_name;
    if (wallet_address !== undefined) updateData.wallet_address = wallet_address;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (bio !== undefined) updateData.bio = bio;
    if (status !== undefined) updateData.status = status;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    res.status(200).json({ 
      message: 'Profile updated', 
      user: {
        display_name: updatedUser.display_name,
        wallet_address: updatedUser.wallet_address,
        avatar_url: updatedUser.avatar_url,
        bio: updatedUser.bio,
        status: updatedUser.status
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const bamboochainLogin = (req: Request, res: Response): void => {
  const authUrl = `${BAMBOOCHAIN_OAUTH_URL}?client_id=${BAMBOOCHAIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code`;
  res.redirect(authUrl);
};

export const bamboochainCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.query;
    if (!code) {
      res.status(400).json({ error: 'Authorization code is missing' });
      return;
    }

    // Exchange code for access token (jika gagal, lanjutkan dengan mock token)
    const tokenResponse = await axios.post(BAMBOOCHAIN_TOKEN_URL, {
      grant_type: 'authorization_code',
      client_id: BAMBOOCHAIN_CLIENT_ID,
      client_secret: BAMBOOCHAIN_CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI
    }).catch((err) => {
      console.warn('Gagal menukar token, menggunakan mock token. Error:', err.message);
      return { data: { access_token: 'mock_access_token_123' } };
    });

    const { access_token } = tokenResponse.data;

    // Simulate fetching user profile from BambooChain using access_token
    const userProfileResponse = await axios.get('https://bamboochain.id/api/user', { headers: { Authorization: `Bearer ${access_token}` } }).catch(() => null);
    
    // Gunakan data asli jika API berhasil, jika gagal gunakan fallback (untuk development)
    const mockWalletAddress = userProfileResponse?.data?.wallet_address || '0x1234567890abcdef1234567890abcdef12345678';
    const mockUsername = userProfileResponse?.data?.username || 'user_bamboochain_' + Math.floor(Math.random() * 1000);
    const mockDisplayName = userProfileResponse?.data?.name || 'BaMbooChain User';

    // Find or create user in our DB
    let user = await prisma.user.findUnique({ where: { username: mockUsername } });
    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash('sso_dummy_password', salt);
      user = await prisma.user.create({
        data: {
          username: mockUsername,
          password_hash,
          display_name: mockDisplayName,
          wallet_address: mockWalletAddress,
        }
      });
    }

    // Generate BambooChat JWT
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    // Redirect to frontend (Vercel) with token
    res.redirect(`https://www.bamboochat.click/login?sso_token=${token}&sso_username=${user.username}&sso_userid=${user.id}`);
  } catch (error: any) {
    console.error('BambooChain SSO Callback Error:', error?.response?.data || error.message);
    res.redirect('https://www.bamboochat.click/login?error=sso_failed');
  }
};
