import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Model } from 'mongoose';
import { RegisterDto } from './dto/register.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @Inject(JwtService) private readonly jwtService: JwtService,
  ) {}

  async create(registerDto: RegisterDto): Promise<User> {
    try {
      const newUser = new this.userModel(registerDto);
      return await newUser.save();
    } catch (error) {
      throw new Error(`Error creating user: ${error}`);
    }
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    try {
      return await this.userModel.findOne({ email }).exec();
    } catch (error) {
      throw new Error(`Error finding user by email: ${error}`);
    }
  }
}
