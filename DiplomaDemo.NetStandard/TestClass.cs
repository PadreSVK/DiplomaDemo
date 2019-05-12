using System;

namespace DiplomaDemo.NetStandard
{
    public class TestClass
    {
        public static int Parse(string input) => Int32.Parse(input);
        public static string SayHello() => "👽 Hello from C# 😎";
        public static int Multiply(int a, int b) => a * b;

        public static int[] GetFibonacci(int count) => new [] { 1,2,3,4,};
    }
}
