using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using MudBlazor.Services;                            // <- MudBlazor

using OnlinePortfolioMk5;                           // <- your new WASM project's root namespace
using OnlinePortfolioMk5.Components.Layout;         // <- adjust to where PageLinks lives in the new project


var builder = WebAssemblyHostBuilder.CreateDefault(args);

// Root components (index.html contains <div id="app"></div>)
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

// HttpClient for API/static file requests from the app's base URL
builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });

// ---- Brought over from the old project (WASM-friendly versions) ----

// MudBlazor services (Snackbar, Dialog, etc.)
builder.Services.AddMudServices(options =>
{
    // Optional: tweak defaults if you want
    // options.SnackbarConfiguration.PositionClass = Defaults.Classes.Position.BottomRight;
    // options.SnackbarConfiguration.ShowCloseIcon = true;
});

// Your app services (move the PageLinks class into this project & namespace)
builder.Services.AddScoped<PageLinks>(); // adjust the type if your class name/namespace differs

// -------------------------------------------------------------------

await builder.Build().RunAsync();