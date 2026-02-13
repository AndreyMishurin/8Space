# Claude Instructions for ShipFast TypeScript SaaS Boilerplate

## Project Context
You are working with a production-ready Next.js 15+ TypeScript SaaS boilerplate called ShipFast. This is a complete starter template for building SaaS applications with payments, authentication, and modern web technologies.

## Architecture Overview

### Core Technologies
- **Frontend**: Next.js 15+ with App Router, React 19+, TypeScript 5.9+
- **Styling**: TailwindCSS 4.1+ with DaisyUI 5.0+ component library
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: NextAuth v5 (beta) with Google OAuth and Email providers
- **Payments**: Stripe integration with webhooks for subscriptions and one-time payments
- **Email**: Resend for transactional emails
- **Blog**: MDX support for content management

### Project Structure
```
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # API routes (auth, stripe, webhooks, leads)
│   ├── blog/              # Blog pages with MDX content
│   ├── dashboard/         # Protected user dashboard
│   └── (auth)/           # Authentication pages
├── components/            # Reusable UI components
├── libs/                 # Utility libraries and configurations
├── models/               # MongoDB/Mongoose models
├── types/                # TypeScript type definitions
└── config.ts            # Centralized configuration
```

## Development Guidelines

### When Writing Code
1. **Always use TypeScript**: Provide proper type definitions for all functions, components, and data structures
2. **Follow Next.js 15+ patterns**: Use App Router, Server Components by default, and "use client" only when necessary
3. **Use existing patterns**: Study existing components and API routes to maintain consistency
4. **Implement proper error handling**: Always use try-catch blocks and provide meaningful error messages
5. **Follow the config pattern**: All configuration should reference `/config.ts`

### Component Development
- Use functional components with hooks
- Implement proper TypeScript interfaces for props
- Use DaisyUI classes for consistent styling
- Include loading states and error handling
- Make components responsive with Tailwind breakpoints
- Follow accessibility best practices

### API Route Development
- Always connect to MongoDB using `connectMongo()` before database operations
- Validate request bodies and return proper HTTP status codes
- Use NextAuth session for authentication when needed
- Implement proper error handling with descriptive messages
- Follow RESTful conventions

### Database Operations
- Use Mongoose models defined in `/models/`
- Always handle async operations properly
- Implement proper error handling for database failures
- Use proper validation in schemas

### Authentication Flow
- NextAuth v5 is configured with Google OAuth and Email providers
- User sessions are stored in JWT tokens
- Protected routes should check authentication status
- User data is stored in MongoDB with proper schema

### Stripe Integration
- Webhooks are handled in `/app/api/webhook/stripe/route.ts`
- Always verify webhook signatures for security
- Update user access based on payment events
- Handle all relevant Stripe events (checkout completed, subscription deleted, etc.)

### Styling Guidelines
- Use TailwindCSS v4 utility classes with CSS-first configuration
- Leverage DaisyUI components: `btn`, `card`, `modal`, `dropdown`, etc.
- Implement responsive design with Tailwind breakpoints
- Use semantic HTML elements
- Include proper ARIA attributes for accessibility
- Configure theme variables in CSS using `@theme` directive
- Use `@import "tailwindcss"` instead of `@tailwind` directives

## Common Tasks and Patterns

### Adding a New Component
1. Create component in `/components/ComponentName.tsx`
2. Use PascalCase for component names
3. Define TypeScript interface for props
4. Use DaisyUI classes for styling
5. Export default the main component

### Creating an API Route
1. Create route in `/app/api/[feature]/route.ts`
2. Export named functions for HTTP methods (GET, POST, etc.)
3. Connect to MongoDB if database operations are needed
4. Validate inputs and handle errors properly
5. Return consistent JSON responses

### Adding a New Page
1. Create page in `/app/[route]/page.tsx`
2. Use Server Components by default
3. Implement proper SEO with metadata
4. Include proper error boundaries
5. Use the layout system appropriately

### Working with the Database
1. Define models in `/models/` using Mongoose schemas
2. Use TypeScript interfaces for type safety
3. Always use `connectMongo()` before operations
4. Handle connection errors gracefully
5. Use proper validation and error handling

### Implementing Authentication
1. Use `auth()` from `/libs/next-auth` to get session
2. Check authentication in API routes when needed
3. Redirect unauthenticated users appropriately
4. Use proper session handling patterns

## Configuration Management
- All app configuration is centralized in `/config.ts`
- Environment variables are properly typed and validated
- Use the `ConfigProps` interface for type safety
- Access config throughout the app using `import config from "@/config"`

## Error Handling Patterns
- Use try-catch blocks in all async operations
- Log errors with descriptive context
- Return proper HTTP status codes in API routes
- Use toast notifications for user-facing errors
- Implement proper loading states in components

## Security Considerations
- Always validate user inputs
- Verify webhook signatures (especially Stripe)
- Use proper authentication checks
- Sanitize data before database operations
- Follow OWASP security guidelines

## Performance Optimization
- Use Next.js Image component for optimized images
- Implement proper lazy loading
- Use Server Components when possible
- Optimize bundle size with proper imports
- Use proper caching strategies

## Testing Approach
- Write unit tests for utility functions
- Test API routes with proper mocking
- Test components with React Testing Library
- Use proper TypeScript types in tests
- Mock external services (Stripe, MongoDB, etc.)

## Deployment Considerations
- Environment variables must be properly configured
- Database connections should be optimized for production
- Webhook endpoints must be accessible
- Static assets should be optimized
- Error monitoring should be implemented

## Common Pitfalls to Avoid
- Don't use `any` type unless absolutely necessary
- Don't forget to connect to MongoDB in API routes
- Don't skip webhook signature verification
- Don't hardcode configuration values
- Don't bypass TypeScript strict mode
- Don't forget error handling in async operations
- Don't create components without proper TypeScript interfaces

## When Helping with This Codebase
1. **Understand the context**: This is a production SaaS boilerplate with real payment processing
2. **Follow existing patterns**: Study how similar functionality is implemented
3. **Maintain consistency**: Use the same coding style and architecture patterns
4. **Consider security**: Always validate inputs and handle sensitive operations properly
5. **Think about user experience**: Implement proper loading states and error handling
6. **Use proper TypeScript**: Provide type safety throughout the application
7. **Follow Next.js best practices**: Use App Router patterns and proper component architecture

## Key Files to Reference
- `/config.ts` - Central configuration
- `/libs/next-auth.ts` - Authentication setup
- `/libs/stripe.ts` - Stripe integration
- `/libs/mongoose.ts` - Database connection
- `/types/config.ts` - Configuration types
- `/components/LayoutClient.tsx` - Client-side layout wrapper
- `/app/api/webhook/stripe/route.ts` - Stripe webhook handling

Remember: This is a complete SaaS boilerplate that handles real payments and user data. Always prioritize security, proper error handling, and user experience in any modifications or additions. 