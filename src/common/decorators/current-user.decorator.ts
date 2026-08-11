import {createParamDecorator,ExecutionContext, Get} from '@nestjs/common';
import { User } from '../../users/entities/user.entity';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

export const CurrentUser = createParamDecorator((fild:string|undefined,ctx:ExecutionContext)=>{
    const request = ctx.switchToHttp().getRequest();
    return fild?request.user[fild] :request.user ;
})

@UseGuards(JwtAuthGuard)
export class TestController {
    @Get()
    test(@CurrentUser() user:User){
        return user;
    }
}