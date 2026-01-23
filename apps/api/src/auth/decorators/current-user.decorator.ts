import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ValidatedUser } from '../strategies/jwt.strategy';

/**
 * Decorator to extract the current authenticated user from the request
 *
 * Works with both REST (HTTP) and GraphQL contexts.
 * Returns the user object attached by the JWT strategy's validate() method.
 *
 * @param data - Optional property to extract from the user object
 * @param ctx - The execution context
 * @returns The user object or a specific property
 *
 * @example
 * ```typescript
 * // Get full user object
 * @Get('profile')
 * getProfile(@CurrentUser() user: ValidatedUser) {
 *   return this.usersService.findById(user.id);
 * }
 *
 * // Get specific property
 * @Get('my-id')
 * getMyId(@CurrentUser('id') userId: string) {
 *   return { id: userId };
 * }
 *
 * // Get email only
 * @Get('my-email')
 * getMyEmail(@CurrentUser('email') email: string) {
 *   return { email };
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof ValidatedUser | undefined, ctx: ExecutionContext) => {
    let user: ValidatedUser | undefined;

    // Check if this is a GraphQL request
    const contextType = ctx.getType<string>();
    if (contextType === 'graphql') {
      const gqlContext = GqlExecutionContext.create(ctx);
      user = gqlContext.getContext().req?.user;
    } else {
      // HTTP request
      const request = ctx.switchToHttp().getRequest();
      user = request.user;
    }

    // If no user found, return undefined (guard should handle authentication)
    if (!user) {
      return undefined;
    }

    // If data property specified, return just that property
    return data ? user[data] : user;
  },
);
