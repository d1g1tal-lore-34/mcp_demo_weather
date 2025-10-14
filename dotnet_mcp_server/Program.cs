using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Identity.Web;
using ModelContextProtocol.AspNetCore.Authentication;
using ModelContextProtocol.Authentication;
using dotenv.net;
DotEnv.Load();

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = McpAuthenticationDefaults.AuthenticationScheme;
}).AddMcp(option =>
{
    var identityOptions = builder
            .Configuration.GetSection("AzureAd")
            .Get<MicrosoftIdentityOptions>()!;

    option.ResourceMetadata = new ProtectedResourceMetadata
    {
        Resource = GetMcpServerUrl(),
        AuthorizationServers = [GetAuthorizationServerUrl(identityOptions)],
        ScopesSupported = [$"api://{identityOptions.ClientId}/MCP.All"],
    };
})
.AddMicrosoftIdentityWebApi(builder.Configuration.GetSection("AzureAd"));

builder.Services.AddHttpContextAccessor();
builder.Services.AddAuthorization();
builder.Services.AddMcpServer().WithToolsFromAssembly().WithHttpTransport();

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();
app.MapMcp().RequireAuthorization();

// app.MapControllers();

app.Run();

static Uri GetAuthorizationServerUrl(MicrosoftIdentityOptions o) => new($"{o.Instance?.TrimEnd('/')}/{o.TenantId}/v2.0");
Uri GetMcpServerUrl() => builder.Configuration.GetValue<Uri>("McpServerUrl");