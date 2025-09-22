using Microsoft.AspNetCore.Components;
using System.Security.Cryptography.X509Certificates;


namespace Online_Portfilio_MK5.Components.Layout
{
   
    public class PageLinks
    {
        private readonly NavigationManager _nav;
        public PageLinks(NavigationManager nav) => _nav = nav; 
        public void OpenPageHome()
        {
            _nav.NavigateTo($"/");
        }
        public void OpenPageCounter()
        {
            _nav.NavigateTo($"/counter");
        }
       
        public void OpenPageWeather()
        {
            _nav.NavigateTo($"/weather");
        }
    }
}
