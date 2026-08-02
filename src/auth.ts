export function checkAuthorz(roles: string[] | undefined, roleName: string): boolean {
    if (roles) {
        roles.includes(roleName);
        return true
    } else {
        return false
    }
}
