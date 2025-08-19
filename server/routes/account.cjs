const express = require('express');
const bcrypt = require('bcrypt');
const { getUserById, updateUserProfile, getUserByEmailWithPassword } = require('../services/mongoUsersService.cjs');

const router = express.Router();

// Update user profile (First Name, Last Name, Email)
router.put('/profile', async (req, res) => {
  try {
    const { userId, FirstName, LastName, Email } = req.body;

    if (!userId || !FirstName || !LastName || !Email) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(Email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Update user profile
    const result = await updateUserProfile(userId, {
      FirstName,
      LastName,
      Email
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: result.user
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to update profile'
      });
    }
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update user password
router.put('/password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }

    // Get user with current password for verification
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user with password for verification
    const userWithPassword = await getUserByEmailWithPassword(user.Email);
    if (!userWithPassword) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userWithPassword.Password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    const result = await updateUserProfile(userId, {
      Password: hashedNewPassword
    });

    if (result.success) {
      res.json({
        success: true,
        message: 'Password updated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to update password'
      });
    }
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;