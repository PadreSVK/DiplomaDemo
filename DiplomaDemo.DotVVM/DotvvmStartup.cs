using DotVVM.Framework.Configuration;
using DotVVM.Framework.ResourceManagement;
using Microsoft.Extensions.DependencyInjection;

namespace DiplomaDemo.DotVVM
{
    public class DotvvmStartup : IDotvvmStartup, IDotvvmServiceConfigurator
    {
        // For more information about this class, visit https://dotvvm.com/docs/tutorials/basics-project-structure
        public void Configure(DotvvmConfiguration config, string applicationPath)
        {
            ConfigureRoutes(config, applicationPath);
            ConfigureResources(config, applicationPath);
        }

        private void ConfigureRoutes(DotvvmConfiguration config, string applicationPath)
        {
            config.RouteTable.Add("Default", "", "Pages/Default.dothtml");
        }

        private void ConfigureResources(DotvvmConfiguration config, string applicationPath)
        {
            config.Resources.Register("require", new ScriptResource()
            {
                Location = new UrlResourceLocation("~/require.js")
            });

            config.Resources.Register("config", new ScriptResource()
            {
                Location = new UrlResourceLocation("~/config.js"),
            });

             config.Resources.Register("mono", new ScriptResource()
            {
                Location = new UrlResourceLocation("~/mono.js"),
                Dependencies = new[] { "config",  "require", "wasm-bootstrap"}
            });

              config.Resources.Register("wasm-bootstrap", new ScriptResource()
            {
                Location = new UrlResourceLocation("~/bootstrap.js"),
                Dependencies = new[] { "config","require"}
            });
        }

        public void ConfigureServices(IDotvvmServiceCollection options)
        {
            options.AddDefaultTempStorages("Temp");
        }
    }
}
