using System.Threading.Tasks;
using DiplomaDemo.NetStandard;
using DotVVM.Framework.ViewModel;

namespace DiplomaDemo.DotVVM.Pages
{
    public class DefaultViewModel : DotvvmViewModelBase
    {
        public int PostBackCounter { get; set; }
        public string SayHelloText { get; set; }
        public int? MultiplyResult { get; set; }
        [Bind(Direction.ClientToServer)] public int MultiplyInputA { get; set; }
        [Bind(Direction.ClientToServer)] public int MultiplyInputB { get; set; }
        public int? ParseResult { get; set; }
        [Bind(Direction.ClientToServer)] public string ParseTextInput { get; set; }


        public override Task Load()
        {
            if (Context.IsPostBack)
            {
                PostBackCounter++;
            }
            return base.Load();
        }

        public void SayHello() => SayHelloText = $"DotVVM /{TestClass.SayHello()}";
        public void Multiply(int a, int b) => MultiplyResult = TestClass.Multiply(a, b);
        public void Parse(string str) => ParseResult = TestClass.Parse(str);
    }
}
