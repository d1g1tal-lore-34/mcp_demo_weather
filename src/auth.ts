export function checkAuthorz(roles: string[] | undefined, roleName: string): boolean {
    return roles?.includes(roleName) === true
}
